import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { optimizeDeliveryRoute, calculateRouteStats } from '@/lib/delivery-router';

export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const routeDateParam = body.routeDate;
    
    const targetDate = routeDateParam ? new Date(routeDateParam) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const reseller = await prisma.localReseller.findUnique({
      where: { id: user.id }
    });

    if (!reseller || reseller.lat === null || reseller.lng === null) {
      return NextResponse.json({ error: 'Reseller location not found' }, { status: 400 });
    }

    const acceptedOrders = await prisma.deliveryOrder.findMany({
      where: {
        resellerId: user.id,
        status: 'accepted',
        routeId: null, // no route assigned yet
        createdAt: { gte: startOfDay, lte: endOfDay }
      },
      include: { buyer: true }
    });

    if (acceptedOrders.length === 0) {
      return NextResponse.json({ error: 'No accepted orders to route' }, { status: 400 });
    }

    const orderDataForRouter = acceptedOrders.map(o => ({
      orderId: o.id,
      buyerLat: o.buyerLat,
      buyerLng: o.buyerLng,
      buyerName: o.buyer?.fullName || o.buyer?.email || 'Customer',
      buyerAddress: o.buyerAddress
    }));

    const optimizedStops = optimizeDeliveryRoute({
      resellerLat: reseller.lat,
      resellerLng: reseller.lng,
      orders: orderDataForRouter,
      departureTime: new Date()
    });

    const stats = calculateRouteStats(optimizedStops);

    const route = await prisma.$transaction(async (tx) => {
      const newRoute = await tx.deliveryRoute.create({
        data: {
          resellerId: user.id,
          routeDate: targetDate,
          status: 'active',
          totalOrders: stats.stopCount,
          totalDistanceKm: stats.totalDistanceKm,
          estimatedMinutes: Math.round(stats.estimatedMinutes),
          startedAt: new Date(),
          stops: {
            create: optimizedStops.map((s, index) => ({
              orderId: s.orderId,
              stopIndex: index,
              buyerLat: s.buyerLat,
              buyerLng: s.buyerLng,
              buyerName: s.buyerName,
              buyerAddress: s.buyerAddress,
              distanceFromPrev: s.distanceFromPrev,
              estimatedArrival: s.estimatedArrival,
              status: 'pending'
            }))
          }
        },
        include: { stops: true }
      });

      for (const order of acceptedOrders) {
        await tx.deliveryOrder.update({
          where: { id: order.id },
          data: {
            status: 'out_for_delivery',
            outForDeliveryAt: new Date()
          }
        });
        
        // TODO: Create RealtimeAction to notify buyer (mocked out for now if model missing)
        // actionType: "order_out_for_delivery"
      }

      return newRoute;
    });

    return NextResponse.json({ route });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
