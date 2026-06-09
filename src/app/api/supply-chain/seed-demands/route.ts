import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/supply-chain/seed-demands
 * ────────────────────────────────────
 * Seeds random LocalDemand records for all local resellers.
 * Then aggregates them into UpazillaDemand.
 * Then aggregates UpazillaDemand into DistrictDemand.
 */

const INTERNAL_SECRET =
  process.env.INTERNAL_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "dev-secret";

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

export async function POST(request: Request) {
  const secret = request.headers.get("X-Internal-Secret");
  if (secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // body is optional
  }

  const minQty: number = body.minQty ?? 10;
  const maxQty: number = body.maxQty ?? 100;
  const productsPerReseller: number = body.productsPerReseller ?? 0; // 0 = random 2–4

  try {
    // ── 1. Fetch LocalResellers ──
    const localResellers = await prisma.localReseller.findMany({
      select: { id: true, upazilla: true },
    });

    if (localResellers.length === 0) {
      return NextResponse.json(
        { error: "No LocalResellers found. Please register local resellers first." },
        { status: 400 }
      );
    }

    // ── 2. Get product catalog ──
    let productNames: string[] = body.productNames ?? [];
    let products: { name: string; code: string }[] = [];

    if (productNames.length === 0) {
      const sellerProducts = await prisma.sellerProduct.findMany({
        where: { status: "approved" },
        select: { productCode: true, customName: true, globalProduct: { select: { name: true } } },
        distinct: ["globalProductId"],
        take: 20,
      });

      products = sellerProducts.map(sp => ({
        name: sp.customName || sp.globalProduct?.name || "Unknown",
        code: sp.productCode,
      }));
    } else {
      const sps = await prisma.sellerProduct.findMany({
        where: {
          status: "approved",
          OR: [
            { customName: { in: productNames } },
            { globalProduct: { name: { in: productNames } } }
          ]
        },
        select: { productCode: true, customName: true, globalProduct: { select: { name: true } } }
      });
      products = sps.map(sp => ({
        name: sp.customName || sp.globalProduct?.name || "Unknown",
        code: sp.productCode,
      }));
    }

    if (products.length === 0) {
      return NextResponse.json(
        { error: "No approved SellerProducts found in catalog." },
        { status: 400 }
      );
    }

    // Map: upazilla name -> upazillaResellerId
    const upazillaResellers = await prisma.upazillaReseller.findMany({
      select: { id: true, upazilla: true, city: true },
    });
    const upazillaMap = new Map(upazillaResellers.map(u => [u.upazilla.toLowerCase(), u]));

    // Map: city(district) name -> districtResellerId
    const districtResellers = await prisma.districtReseller.findMany({
      select: { id: true, district: true },
    });
    const districtMap = new Map(districtResellers.map(d => [d.district.toLowerCase(), d.id]));

    // Accumulators
    const upazillaDemands = new Map<string, Map<string, number>>(); // upazillaId -> { productName -> qty }
    const districtDemands = new Map<string, Map<string, number>>(); // districtId -> { productName -> qty }

    let localDemandCount = 0;
    const errors: string[] = [];

    // ── 3. Seed LocalDemand ──
    for (const lr of localResellers) {
      const numProducts = productsPerReseller > 0 ? productsPerReseller : randInt(2, Math.min(4, products.length));
      const chosen = pickRandom(products, numProducts);

      for (const p of chosen) {
        const qty = randInt(minQty, maxQty);

        try {
          await prisma.localDemand.upsert({
            where: {
              localResellerId_productCode: { localResellerId: lr.id, productCode: p.code }
            },
            create: {
              localResellerId: lr.id,
              productCode: p.code,
              productName: p.name,
              demandQuantity: qty,
              fulfilledQuantity: 0,
              status: "pending",
            },
            update: {
              demandQuantity: qty,
              fulfilledQuantity: 0,
              status: "pending",
            }
          });
          localDemandCount++;

          // Bubble to upazilla
          const ur = upazillaMap.get((lr.upazilla || "").toLowerCase());
          if (ur) {
            if (!upazillaDemands.has(ur.id)) upazillaDemands.set(ur.id, new Map());
            const pMap = upazillaDemands.get(ur.id)!;
            pMap.set(p.name, (pMap.get(p.name) || 0) + qty);

            // Bubble to district
            const drId = districtMap.get((ur.city || "").toLowerCase());
            if (drId) {
              if (!districtDemands.has(drId)) districtDemands.set(drId, new Map());
              const dMap = districtDemands.get(drId)!;
              dMap.set(p.name, (dMap.get(p.name) || 0) + qty);
            }
          }
        } catch (e: any) {
          errors.push(`LocalDemand ${lr.id}/${p.name}: ${e.message}`);
        }
      }
    }

    // ── 4. Upsert UpazillaDemand ──
    let upaCount = 0;
    for (const [urId, pMap] of upazillaDemands.entries()) {
      for (const [productName, qty] of pMap.entries()) {
        await prisma.upazillaDemand.upsert({
          where: { upazillaResellerId_productName: { upazillaResellerId: urId, productName } },
          create: {
            upazillaResellerId: urId,
            productName,
            demandQuantity: qty,
            fulfilledQuantity: 0,
            status: "pending",
            enteredBy: "system-seed"
          },
          update: {
            demandQuantity: qty,
            fulfilledQuantity: 0,
            status: "pending"
          }
        });
        upaCount++;
      }
    }

    // ── 5. Upsert DistrictDemand ──
    let distCount = 0;
    for (const [drId, dMap] of districtDemands.entries()) {
      for (const [productName, qty] of dMap.entries()) {
        await prisma.districtDemand.upsert({
          where: { districtResellerId_productName: { districtResellerId: drId, productName } },
          create: {
            districtResellerId: drId,
            productName,
            totalDemand: qty,
            remainingDemand: qty,
            status: "pending"
          },
          update: {
            totalDemand: qty,
            remainingDemand: qty,
            status: "pending"
          }
        });
        distCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Demands seeded successfully across all layers",
      localResellersProcessed: localResellers.length,
      localDemandsCreated: localDemandCount,
      upazillaDemandsCreated: upaCount,
      districtDemandsCreated: distCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Seed demands error:", error);
    return NextResponse.json(
      { error: "Seed failed", details: error.message },
      { status: 500 }
    );
  }
}
