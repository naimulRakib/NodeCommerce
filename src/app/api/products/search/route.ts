import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase-server";
import { trackBehaviour } from "@/lib/behaviour";

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

    // Track behaviour asynchronously
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const buyerId = user?.id || null;
    
    // Fire and forget
    trackBehaviour(buyerId, "search", { query: q, category, resultsCount: total });

    return NextResponse.json({
        products: formattedProducts,
        total,
        page,
        totalPages: Math.ceil(total / pageSize)
    });
}