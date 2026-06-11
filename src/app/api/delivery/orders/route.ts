import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { generateOrderQR } from '@/lib/qr-generator';

export async function GET(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const url = new URL(request.url);
  const role = url.searchParams.get('role');

  if (role === 'reseller') {
    const orders = await prisma.deliveryOrder.findMany({
      where: { resellerId: user.id },
      include: {
        items: true,
        buyer: { select: { fullName: true, email: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ orders });
  }

  // Default: buyer history
  const orders = await prisma.deliveryOrder.findMany({
    where: { buyerId: user.id },
    include: {
      items: true,
      reseller: { select: { username: true, resellerCode: true, phone: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { items, buyerLat, buyerLng, buyerAddress, deliveryType, buyerNote, paymentMethod } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    if (!buyerAddress) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    // Bangladesh bounds check
    if (buyerLat < 20.5 || buyerLat > 26.7 || buyerLng < 88.0 || buyerLng > 92.7) {
      return NextResponse.json({ error: 'Location must be within Bangladesh bounds' }, { status: 400 });
    }

    const firstResellerId = items[0].resellerId;
    for (const item of items) {
      if (item.resellerId !== firstResellerId) {
        return NextResponse.json({ error: 'All items must be from the same reseller' }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate orderNumber: "ORD-YYYY-XXXX"
      const year = new Date().getFullYear();
      const count = await tx.deliveryOrder.count({
        where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00.000Z`) } }
      });
      const orderNumber = `ORD-${year}-${String(count + 1).padStart(5, '0')}`;

      let totalAmount = 0;
      const orderItemsData = [];

      for (const item of items) {
        // Lock stock item
        const stockItem = await tx.resellerStockItem.findUnique({
          where: { id: item.stockItemId },
          include: { sellerProduct: { include: { globalProduct: true } } }
        });

        if (!stockItem || stockItem.resellerId !== firstResellerId) {
          throw new Error(`Invalid stock item: ${item.stockItemId}`);
        }

        if (stockItem.quantity < item.quantity) {
          const name = stockItem.customName || stockItem.sellerProduct?.globalProduct?.name || 'Product';
          throw new Error(`Insufficient stock for ${name}. Only ${stockItem.quantity} available.`);
        }

        const price = stockItem.sellerProduct?.price || 0;
        const productName = stockItem.customName || stockItem.sellerProduct?.globalProduct?.name || 'Unknown Product';
        const productCode = stockItem.sellerProduct?.productCode || 'N/A';

        // Decrement stock
        await tx.resellerStockItem.update({
          where: { id: item.stockItemId },
          data: { quantity: { decrement: item.quantity } }
        });

        totalAmount += (price * item.quantity);

        orderItemsData.push({
          stockItemId: item.stockItemId,
          productCode,
          productName,
          quantity: item.quantity,
          priceAtOrder: price
        });
      }

      const buyer = await tx.buyerProfile.findUnique({ where: { id: user.id } });
      if (!buyer) throw new Error("Buyer profile not found");

      if (paymentMethod === "WALLET") {
        if (buyer.walletBalance < totalAmount) {
          throw new Error("Insufficient wallet balance");
        }
        await tx.buyerProfile.update({
          where: { id: user.id },
          data: { walletBalance: { decrement: totalAmount } }
        });
      }

      // 3. Create DeliveryOrder
      const order = await tx.deliveryOrder.create({
        data: {
          buyerId: user.id,
          resellerId: firstResellerId,
          orderNumber,
          deliveryType: deliveryType || 'delivery',
          totalAmount,
          buyerLat,
          buyerLng,
          buyerAddress,
          buyerNote,
          items: {
            create: orderItemsData
          }
        },
        include: { items: true, buyer: true }
      });

      // 5. Generate QR code
      const qrCode = generateOrderQR({
        orderNumber,
        buyerId: user.id,
        resellerId: firstResellerId
      });

      // 6. Update order.qrCode
      const finalOrder = await tx.deliveryOrder.update({
        where: { id: order.id },
        data: { qrCode }
      });

      // TODO: Create RealtimeAction for reseller (mocked out for now if RealtimeAction model missing)
      // Usually would be: tx.realtimeAction.create(...)

      return { order: finalOrder, qrCode };
    });

    return NextResponse.json({
      order: result.order,
      qrCode: result.qrCode,
      message: 'Order placed! Waiting for reseller.'
    });

  } catch (err: any) {
    if (err.message && err.message.includes('Insufficient stock')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
