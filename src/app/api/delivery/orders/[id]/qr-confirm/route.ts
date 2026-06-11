import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { verifyOrderQR } from '@/lib/qr-generator';
import { generateReceiptHTML } from '@/lib/receipt-generator';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { qrString } = await request.json();
    const orderId = params.id;

    const order = await prisma.deliveryOrder.findUnique({
      where: { id: orderId },
      include: { 
        items: true,
        buyer: true,
        reseller: true,
        stop: true
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.resellerId !== user.id) {
      return NextResponse.json({ error: `This delivery belongs to another reseller, not you.` }, { status: 403 });
    }

    if (order.status === 'delivered') {
      return NextResponse.json({ error: `Order #${order.orderNumber} already confirmed at ${order.qrScannedAt?.toISOString()}` }, { status: 400 });
    }

    if (order.status !== 'out_for_delivery') {
      return NextResponse.json({ error: 'Order must be out for delivery to confirm' }, { status: 400 });
    }

    const verification = verifyOrderQR(qrString);
    if (!verification.valid) {
      return NextResponse.json({ error: 'Invalid QR code' }, { status: 400 });
    }

    if (verification.expired) {
      return NextResponse.json({ error: 'QR code expired. Contact support for manual confirmation.' }, { status: 400 });
    }

    if (verification.orderNumber !== order.orderNumber) {
      return NextResponse.json({ error: `This QR code is for order ${verification.orderNumber}, not ${order.orderNumber}.` }, { status: 400 });
    }

    if (verification.resellerId !== user.id) {
      return NextResponse.json({ error: `This QR code does not match your reseller ID.` }, { status: 403 });
    }

    const now = new Date();

    // Generate Receipt
    const receiptHtml = generateReceiptHTML({
      order,
      buyer: order.buyer,
      reseller: order.reseller,
      deliveredAt: now
    });

    // Upload to Supabase Storage
    const supabase = await createClient();
    const fileName = `${order.orderNumber}-${now.getTime()}.html`;
    let receiptUrl = `/api/delivery/receipt/${order.id}`; // fallback
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, receiptHtml, { contentType: 'text/html', upsert: true });

    if (!uploadError && uploadData) {
      const { data: publicUrlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
      if (publicUrlData?.publicUrl) {
        receiptUrl = publicUrlData.publicUrl;
      }
    }

    // Transaction to complete order and route
    const confirmedOrder = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.deliveryOrder.update({
        where: { id: orderId },
        data: {
          status: 'delivered',
          deliveredAt: now,
          qrScannedAt: now,
          receiptSentAt: now,
          receiptUrl
        }
      });

      if (order.stop) {
        await tx.deliveryStop.update({
          where: { id: order.stop.id },
          data: {
            status: 'completed',
            actualArrival: now,
            completedAt: now
          }
        });

        // Check if all stops in route are completed
        const remainingStops = await tx.deliveryStop.count({
          where: {
            routeId: order.stop.routeId,
            status: { not: 'completed' }
          }
        });

        if (remainingStops === 0) {
          await tx.deliveryRoute.update({
            where: { id: order.stop.routeId },
            data: {
              status: 'completed',
              completedAt: now
            }
          });
        }
      }

      return updatedOrder;
    });

    // TODO: Notify buyer (mocked for now)

    return NextResponse.json({
      confirmed: true,
      order: confirmedOrder,
      receiptUrl
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
