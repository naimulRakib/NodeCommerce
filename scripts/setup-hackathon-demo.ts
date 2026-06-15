import { prisma } from "../src/lib/prisma";
import crypto from "crypto";

// Helper to generate dates in the past (1 to 30 days ago)
function getRandomPastDate(daysAgoMin = 1, daysAgoMax = 30) {
  const days = Math.floor(Math.random() * (daysAgoMax - daysAgoMin + 1)) + daysAgoMin;
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return date;
}

async function main() {
  console.log("Setting up MASSIVE Hackathon ACO demo environment...");

  // 1. Wipe existing data
  console.log("Cleaning database...");
  await prisma.aCOShipmentItem.deleteMany({});
  await prisma.aCOShipment.deleteMany({});
  await prisma.aCOGlobalJob.deleteMany({});
  await prisma.localDemand.deleteMany({});
  await prisma.upazillaDemand.deleteMany({});
  await prisma.districtDemand.deleteMany({});
  await prisma.sellerProduct.deleteMany({
    where: { productCode: { in: ["DEMO-RICE-001", "ELEC-MAX-999", "HONEY-ORG-250"] } }
  });
  await prisma.sellerProduct.updateMany({ data: { stock: 0 } });
  await prisma.upazillaStockItem.deleteMany({});
  await prisma.districtStockItem.deleteMany({});
  await prisma.resellerStockItem.deleteMany({});

  // Fetch nodes
  let dhakaDistrict = await prisma.districtReseller.findUnique({ where: { email: "district.dhaka@demo.com" } });
  if (!dhakaDistrict) dhakaDistrict = await prisma.districtReseller.create({ data: { id: crypto.randomUUID(), email: "district.dhaka@demo.com", district: "Dhaka" } });
  let cumillaDistrict = await prisma.districtReseller.findUnique({ where: { email: "district.cumilla@demo.com" } });
  if (!cumillaDistrict) cumillaDistrict = await prisma.districtReseller.create({ data: { id: crypto.randomUUID(), email: "district.cumilla@demo.com", district: "Cumilla" } });

  const dhakaUpazillaMirpur = await prisma.upazillaReseller.findFirst({ where: { upazilla: "Mirpur" } });
  const dhakaUpazillaUttara = await prisma.upazillaReseller.findFirst({ where: { upazilla: "Uttara" } });
  const cumillaUpazillaBurichang = await prisma.upazillaReseller.findFirst({ where: { upazilla: "Burichang" } });
  const cumillaUpazillaDaudkandi = await prisma.upazillaReseller.findFirst({ where: { upazilla: "Daudkandi" } });

  const dhakaLocalMirpur = await prisma.localReseller.findFirst({ where: { upazilla: "Mirpur" } });
  const dhakaLocalUttara = await prisma.localReseller.findFirst({ where: { upazilla: "Uttara" } });
  
  const cumillaSeller = await prisma.profile.findFirst({ where: { upazilla: "Burichang", type: "seller" } });
  const dhakaSeller = await prisma.profile.findFirst({ where: { city: "Dhaka", type: "seller" } });

  if (!dhakaDistrict || !cumillaDistrict || !dhakaLocalMirpur || !cumillaSeller || !dhakaSeller || !dhakaUpazillaMirpur || !cumillaUpazillaBurichang) {
    throw new Error(`Missing core nodes.`);
  }

  const globalProducts = await prisma.globalProduct.findMany({ take: 5 });
  if (globalProducts.length < 2) throw new Error("Need at least 2 global products");

  // ==========================================
  // 2. THE PERFECT 4-PHASE CORE DEMO (Untouched)
  // ==========================================
  const coreProductName = "Demo Premium Rice";
  const coreProductCode = "DEMO-RICE-001";

  await prisma.sellerProduct.create({
    data: {
      sellerId: cumillaSeller.id,
      globalProductId: globalProducts[0].id,
      productCode: coreProductCode,
      customName: coreProductName,
      stock: 10000,
      price: 50,
      status: "approved"
    }
  });

  await prisma.localDemand.create({
    data: { localResellerId: dhakaLocalMirpur.id, productName: coreProductName, productCode: coreProductCode, demandQuantity: 5000, status: "pending" }
  });
  
  await prisma.upazillaDemand.create({
    data: { upazillaResellerId: dhakaUpazillaMirpur.id, productName: coreProductName, demandQuantity: 5000, fulfilledQuantity: 0, status: "pending", enteredBy: "demo" }
  });

  await prisma.districtDemand.create({
    data: { districtResellerId: dhakaDistrict.id, productName: coreProductName, totalDemand: 5000, remainingDemand: 5000, status: "pending" }
  });

  console.log("Core Demo setup: 10,000 Rice in Cumilla, 5,000 Demand in Dhaka.");

  // ==========================================
  // 3. EDGE CASES & DIVERSE INVENTORY
  // ==========================================
  const edgeCaseProduct = "Edge Case Electronics";
  
  // Massive Over-Supply with ZERO demand (Edge Case 1)
  await prisma.sellerProduct.create({
    data: {
      sellerId: dhakaSeller.id,
      globalProductId: globalProducts[1].id,
      productCode: "ELEC-MAX-999",
      customName: edgeCaseProduct,
      stock: 50000,
      price: 200,
      status: "approved"
    }
  });

  // Micro-fulfillments (Edge Case 2)
  const microProduct = "Organic Honey (250g)";
  const microProductCode = "HONEY-ORG-250";
  await prisma.sellerProduct.create({
    data: { sellerId: dhakaSeller.id, globalProductId: globalProducts[2]?.id || globalProducts[0].id, productCode: microProductCode, customName: microProduct, stock: 50, price: 300, status: "approved" }
  });
  await prisma.upazillaDemand.create({
    data: { upazillaResellerId: dhakaUpazillaUttara!.id, productName: microProduct, demandQuantity: 5, fulfilledQuantity: 0, status: "pending", enteredBy: "demo" }
  });


  // ==========================================
  // 4. HISTORICAL JOBS & SHIPMENTS (For Analytics UI)
  // ==========================================
  console.log("Generating rich historical data for Analytics & Pipeline...");

  for (let i = 0; i < 25; i++) {
    const pastDate = getRandomPastDate(1, 30);
    const isCompleted = Math.random() > 0.1; // 90% completed
    
    const qty = Math.floor(Math.random() * 2000) + 100;
    
    // Create Job
    const job = await prisma.aCOGlobalJob.create({
      data: {
        triggeredBy: "system_cron",
        triggerType: "automatic",
        sourceDistrict: i % 2 === 0 ? "Dhaka" : "Cumilla",
        productScope: [coreProductName, edgeCaseProduct],
        totalSupply: { [coreProductName]: 15000, [edgeCaseProduct]: 5000 },
        totalDemand: { [coreProductName]: 15000, [edgeCaseProduct]: 5000 },
        status: isCompleted ? "completed" : "running",
        phase1Summary: { filled: qty, shipments: 1, negotiations: 0 },
        phase2Summary: { filled: qty, shipments: 1, surplus: 0 },
        phase3Summary: { proposed: 0, shipments: 0, opportunities: 0 },
        phase4Summary: { filled: 0, shipments: 0, note: "" },
        conservationCheck: { balanced: true, totalDiscrepancy: 0 },
        startedAt: pastDate,
        completedAt: isCompleted ? pastDate : null
      }
    });

    // Create corresponding Shipments (Phase 1 & 2 to show action)
    if (isCompleted) {
      await prisma.aCOShipment.create({
        data: {
          jobId: job.id,
          phase: 1,
          fromType: "seller",
          fromId: dhakaSeller.id,
          fromName: "Dhaka Mega Seller",
          toType: "upazilla",
          toId: dhakaUpazillaUttara!.id,
          toName: "Uttara Hub",
          status: "received",
          distanceKm: Math.random() * 20 + 5,
          totalQuantity: qty,
          overallAcoScore: 1.5,
          createdAt: pastDate,
          updatedAt: pastDate,
          lineItems: {
            create: {
              productName: coreProductName,
              allocatedQty: qty,
              acoScore: 1.5,
              pheromoneScore: 1.0,
              demandAtTime: qty,
              allocationReason: "demand_fill"
            }
          }
        }
      });
      
      // Every 3rd run has a Phase 3 inter-district transfer
      if (i % 3 === 0) {
        await prisma.aCOShipment.create({
          data: {
            jobId: job.id,
            phase: 3,
            fromType: "district_hub",
            fromId: cumillaDistrict.id,
            fromName: "Cumilla District Hub",
            toType: "district_hub",
            toId: dhakaDistrict.id,
            toName: "Dhaka District Hub",
            status: "received",
            sourceApproved: true,
            targetApproved: true,
            distanceKm: 95.5,
            totalQuantity: qty,
            overallAcoScore: 2.1,
            createdAt: pastDate,
            updatedAt: pastDate,
            lineItems: {
              create: {
                productName: coreProductName,
                allocatedQty: qty,
                acoScore: 2.1,
                pheromoneScore: 1.0,
                demandAtTime: qty,
                allocationReason: "inter_district"
              }
            }
          }
        });
      }
    }
  }

  console.log("Hackathon Environment Fully Provisioned! 🚀");
}

main().catch(console.error).finally(() => prisma.$disconnect());
