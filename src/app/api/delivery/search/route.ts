import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function GET(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';
  const latParam = url.searchParams.get('lat');
  const lngParam = url.searchParams.get('lng');
  const radius = parseFloat(url.searchParams.get('radius') || '5');

  const buyer = await prisma.buyerProfile.findUnique({ where: { id: user.id } });
  if (!buyer) return NextResponse.json({ error: 'Buyer not found' }, { status: 404 });

  const buyerLat = latParam ? parseFloat(latParam) : buyer.lat;
  const buyerLng = lngParam ? parseFloat(lngParam) : buyer.lng;

  if (buyerLat === null || buyerLng === null || isNaN(buyerLat) || isNaN(buyerLng)) {
    return NextResponse.json({ error: 'Location required. Please enable GPS or save your address.' }, { status: 400 });
  }

  // Bounding Box Pre-Filtering (approx 1 degree = 111km)
  const latDelta = radius / 111;
  const lngDelta = radius / (111 * Math.cos(buyerLat * Math.PI / 180));
  const minLat = buyerLat - latDelta;
  const maxLat = buyerLat + latDelta;
  const minLng = buyerLng - lngDelta;
  const maxLng = buyerLng + lngDelta;

  // Find all LocalResellers in the bounding box (utilizes @@index([lat, lng]))
  const resellers = await prisma.localReseller.findMany({
    where: {
      lat: { gte: minLat, lte: maxLat },
      lng: { gte: minLng, lte: maxLng },
      upazilla: buyer.upazilla || undefined
    },
    include: {
      stock: {
        where: {
          quantity: { gt: 0 },
          OR: [
            { customName: { contains: query, mode: 'insensitive' } },
            { sellerProduct: { globalProduct: { name: { contains: query, mode: 'insensitive' } } } }
          ]
        },
        include: {
          sellerProduct: {
            include: { globalProduct: true }
          }
        }
      }
    }
  });

  const results: any[] = [];

  for (const reseller of resellers) {
    if (reseller.lat === null || reseller.lng === null) continue;

    const distanceKm = haversineKm(buyerLat, buyerLng, reseller.lat, reseller.lng);
    
    if (distanceKm <= radius) {
      const distanceLabel = distanceKm < 1 ? `${Math.round(distanceKm * 1000)} মিটার` : `${distanceKm.toFixed(1)} কিমি`;

      for (const stockItem of reseller.stock) {
        const productCode = stockItem.sellerProduct?.productCode || 'N/A';
        const productName = stockItem.customName || stockItem.sellerProduct?.globalProduct?.name || 'Unknown Product';
        const brand = stockItem.sellerProduct?.globalProduct?.brand || '';
        const price = stockItem.sellerProduct?.price || 0;

        results.push({
          resellerId: reseller.id,
          resellerName: reseller.username,
          resellerCode: reseller.resellerCode,
          resellerLat: reseller.lat,
          resellerLng: reseller.lng,
          distanceKm,
          distanceLabel,
          stockItemId: stockItem.id,
          productCode,
          productName,
          brand,
          quantity: stockItem.quantity,
          price
        });
      }
    }
  }

  // Sort by distance ascending
  results.sort((a, b) => a.distanceKm - b.distanceKm);

  return NextResponse.json({
    results,
    query,
    buyerUpazilla: buyer.upazilla,
    totalResults: results.length
  });
}
