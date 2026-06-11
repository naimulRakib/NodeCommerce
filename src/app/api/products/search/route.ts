import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase-server";
import { trackBehaviour } from "@/lib/behaviour";
import { redis } from "@/lib/redis";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const isSeller = searchParams.get("type") === "seller";

    // Backward compatibility for seller global product search
    if (isSeller) {
        if (q.length < 2) return NextResponse.json({ products: [] });
        const products = await prisma.globalProduct.findMany({
            where: {
                OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { brand: { contains: q, mode: "insensitive" } },
                    { category: { contains: q, mode: "insensitive" } },
                ],
            },
            take: 8,
        });

          // For the seller UI we also surface which of these the caller
          // already stocks. The `inInventory` map is keyed by globalProduct
          // id and carries the SellerProduct's own id (needed for the
          // PATCH /api/seller/inventory/[id] update path) plus the current
          // stock and price so the form can prefill them.
          const supabase = await createClient();
          const { data: { user } } = await supabase.auth.getUser();
          let inInventory: Record<
              string,
              { id: string; stock: number; price: number }
          > = {};
          if (user && products.length > 0) {
              const owned = await prisma.sellerProduct.findMany({
                  where: {
                      sellerId: user.id,
                      globalProductId: {
                          in: products.map((p: { id: string }) => p.id),
                      },
                  },
                  select: {
                      id: true,
                      stock: true,
                      price: true,
                      globalProductId: true,
                  },
              });
              inInventory = Object.fromEntries(
                  owned.map((sp) => [
                      sp.globalProductId as string,
                      {
                          id: sp.id as string,
                          stock: sp.stock as number,
                          price: sp.price as number,
                      },
                  ]),
              );
          }

          return NextResponse.json({ products, inInventory });
    }

    const category = searchParams.get("category") || "";
    const upazilla = searchParams.get("upazilla") || "";
    const minPrice = Number(searchParams.get("minPrice") || 0);
    const maxPrice = Number(searchParams.get("maxPrice") || 0);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || 20)));

    const where: any = {
        AND: []
    };

    if (q) {
        where.AND.push({
            OR: [
                { customName: { contains: q, mode: "insensitive" } },
                { globalProduct: { name: { contains: q, mode: "insensitive" } } },
                { globalProduct: { brand: { contains: q, mode: "insensitive" } } },
                { globalProduct: { category: { contains: q, mode: "insensitive" } } },
            ]
        });
    }

    if (category) {
        where.AND.push({
            globalProduct: { category: { equals: category, mode: "insensitive" } }
        });
    }

    if (upazilla) {
        where.AND.push({
            seller: { upazilla: { equals: upazilla, mode: "insensitive" } }
        });
    }

    if (minPrice > 0) {
        where.price = { ...where.price, gte: minPrice };
    }
    if (maxPrice > 0) {
        where.price = { ...where.price, lte: maxPrice };
    }

    if (where.AND.length === 0) {
        delete where.AND;
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const buyerId = user?.id || null;
    let buyerLat = 23.8;
    let buyerLng = 90.4;

    if (buyerId) {
        const bp = await prisma.buyerProfile.findUnique({ where: { id: buyerId } });
        if (bp?.lat && bp?.lng) {
            buyerLat = bp.lat;
            buyerLng = bp.lng;
        }
    }

    // Try Cache First
    const cacheKey = `search:${q}:${category}:${upazilla}:${minPrice}:${maxPrice}:${page}:${pageSize}:${buyerLat}:${buyerLng}`;
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            trackBehaviour(buyerId, "search", { query: q, category, cached: true });
            return NextResponse.json(JSON.parse(cached));
        }
    } catch (e) {
        console.warn("Redis cache read failed", e);
    }

    const [total, sellerProducts] = await Promise.all([
        prisma.sellerProduct.count({ where }),
        prisma.sellerProduct.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
                globalProduct: true,
                seller: {
                    select: { storeName: true, city: true, upazilla: true, sellerCode: true }
                }
            }
        })
    ]);

    const formattedProducts = sellerProducts.map((sp: any) => ({
        id: sp.id,
        name: sp.customName || sp.globalProduct?.name || "Unknown",
        brand: sp.globalProduct?.brand || "",
        category: sp.globalProduct?.category || "",
        imageUrl: sp.globalProduct?.imageUrl || "",
        price: sp.price,
        stock: sp.stock,
        seller: sp.seller
    }));

    // Find nearest Local Reseller stock for each product
    function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    const productsWithNearest = await Promise.all(formattedProducts.map(async (p: any) => {
        const localStocks = await prisma.resellerStockItem.findMany({
            where: { sellerProductId: p.id, quantity: { gt: 0 } },
            include: { reseller: true }
        });

        let nearest = null;
        let minDistance = Infinity;

        for (const ls of localStocks) {
            const lat = ls.reseller.lat || 23.8;
            const lng = ls.reseller.lng || 90.4;
            const dist = getDistance(buyerLat, buyerLng, lat, lng);
            if (dist < minDistance) {
                minDistance = dist;
                nearest = {
                    name: ls.reseller.username,
                    distanceKm: dist,
                    stock: ls.quantity
                };
            }
        }

        return { ...p, nearestReseller: nearest };
    }));
    
    // Fire and forget
    trackBehaviour(buyerId, "search", { query: q, category, resultsCount: total });

    const responseData = {
        products: productsWithNearest,
        total,
        page,
        totalPages: Math.ceil(total / pageSize)
    };

    // Cache the response for 2 minutes (120 seconds)
    try {
        await redis.setex(cacheKey, 120, JSON.stringify(responseData));
    } catch (e) {
        console.warn("Redis cache write failed", e);
    }

    return NextResponse.json(responseData);
}