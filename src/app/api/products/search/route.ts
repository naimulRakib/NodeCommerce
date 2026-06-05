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
        return NextResponse.json({ products });
    }

    // --- BUYER SEARCH LOGIC ---
    const category = searchParams.get("category") || "";
    const upazilla = searchParams.get("upazilla") || "";
    const minPrice = parseFloat(searchParams.get("minPrice") || "0");
    const maxPrice = parseFloat(searchParams.get("maxPrice") || "0");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = 20;

    const where: any = {
        status: "approved",
        stock: { gt: 0 },
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