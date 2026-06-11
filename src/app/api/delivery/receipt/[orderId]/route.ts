import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { generateReceiptHTML } from '@/lib/receipt-generator';

export async function GET(request: Request, { params }: { params: { orderId: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const orderId = params.orderId;

    const order = await prisma.deliveryOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        buyer: true,
        reseller: true
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.buyerId !== user.id && order.resellerId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to view this receipt' }, { status: 403 });
    }

    if (order.status !== 'delivered') {
      return NextResponse.json({ error: 'Order is not delivered yet, no receipt available.' }, { status: 400 });
    }

    const receiptHtml = generateReceiptHTML({
      order,
      buyer: order.buyer,
      reseller: order.reseller,
      deliveredAt: order.deliveredAt || new Date()
    });

    return new NextResponse(receiptHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
