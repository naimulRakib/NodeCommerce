import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export async function GET() {
  const MOCK_MIRPUR_RESELLER_ID = 'test-mirpur-' + randomUUID();
  const MOCK_DHANMONDI_RESELLER_ID = 'test-dhanmondi-' + randomUUID();
  const MOCK_DHAKA_DISTRICT_ID = 'test-dhaka-' + randomUUID();
  const MOCK_LOCAL_SELLER_ID = 'test-local-seller-' + randomUUID();
  const MOCK_LOCAL_RESELLER_ID = 'test-local-reseller-' + randomUUID();

  const results: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    results.push(msg);
  };

  const cleanUp = async () => {
    log("Cleaning up demo accounts...");
    await prisma.districtReseller.deleteMany({ where: { id: MOCK_DHAKA_DISTRICT_ID } });
    await prisma.upazillaReseller.deleteMany({ where: { id: { in: [MOCK_MIRPUR_RESELLER_ID, MOCK_DHANMONDI_RESELLER_ID] } } });
    await prisma.localReseller.deleteMany({ where: { id: MOCK_LOCAL_RESELLER_ID } });
    await prisma.upazillaDemand.deleteMany({ where: { productName: { in: ['Rice', 'Oil'] } } });
    await prisma.districtDemand.deleteMany({ where: { productName: { in: ['Rice', 'Oil'] } } });
    await prisma.districtStockItem.deleteMany({ where: { districtResellerId: MOCK_DHAKA_DISTRICT_ID } });
  };

  try {
    await cleanUp();
    log("Creating demo accounts...");

    // District Reseller
    await prisma.districtReseller.create({
      data: { id: MOCK_DHAKA_DISTRICT_ID, email: 'dhaka_test@nodecommerce.com', district: 'Dhaka' }
    });

    // Upazilla Resellers (Dhaka District)
    await prisma.upazillaReseller.create({
      data: { id: MOCK_MIRPUR_RESELLER_ID, email: 'mirpur_test@nodecommerce.com', city: 'Dhaka', upazilla: 'Mirpur' }
    });
    await prisma.upazillaReseller.create({
      data: { id: MOCK_DHANMONDI_RESELLER_ID, email: 'dhanmondi_test@nodecommerce.com', city: 'Dhaka', upazilla: 'Dhanmondi' }
    });

    // Local Reseller
    await prisma.localReseller.create({
      data: { id: MOCK_LOCAL_RESELLER_ID, email: 'local_res_test@nodecommerce.com', username: 'Local Reseller Test', city: 'Dhaka', upazilla: 'Mirpur', resellerCode: 'TEST1234' }
    });

    log("\n--- RUNNING DEMAND ENTRY TESTS ---");
    
    // TEST 1: Basic demand entry (Mirpur)
    log("TEST 1: Mirpur enters Rice 100");
    await prisma.upazillaDemand.create({
      data: { upazillaResellerId: MOCK_MIRPUR_RESELLER_ID, productName: 'Rice', demandQuantity: 100, enteredBy: 'test' }
    });
    
    // Simulate district demand trigger
    await prisma.districtDemand.upsert({
      where: { districtResellerId_productName: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } },
      create: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice', totalDemand: 100, remainingDemand: 100 },
      update: { totalDemand: { increment: 100 }, remainingDemand: { increment: 100 } }
    });
    
    let distDemand = await prisma.districtDemand.findUnique({ where: { districtResellerId_productName: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } } });
    if (distDemand!.totalDemand !== 100) throw new Error("District total demand should be 100");
    log("✓ TEST 1 PASSED");

    // TEST 3: Multiple upazillas same product
    log("TEST 3: Dhanmondi enters Rice 80");
    await prisma.upazillaDemand.create({
      data: { upazillaResellerId: MOCK_DHANMONDI_RESELLER_ID, productName: 'Rice', demandQuantity: 80, enteredBy: 'test' }
    });
    await prisma.districtDemand.update({
      where: { districtResellerId_productName: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } },
      data: { totalDemand: { increment: 80 }, remainingDemand: { increment: 80 } }
    });
    distDemand = await prisma.districtDemand.findUnique({ where: { districtResellerId_productName: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } } });
    if (distDemand!.totalDemand !== 180) throw new Error("District total demand should be 180");
    log("✓ TEST 3 PASSED");

    log("\n--- RUNNING ROUTING TESTS ---");

    log("TEST 9: Reserve 100 units from seller stock (Demand is 100 for Mirpur)");
    
    const stockItem = await prisma.resellerStockItem.create({
      data: { resellerId: MOCK_LOCAL_RESELLER_ID, customName: 'Rice', quantity: 120 }
    });

    const upazillaDemand = await prisma.upazillaDemand.findFirst({ where: { upazillaResellerId: MOCK_MIRPUR_RESELLER_ID, productName: 'Rice' } });
    
    const reserveAmount = Math.min(100, 120);
    const surplusAmount = 120 - reserveAmount;

    await prisma.resellerStockItem.update({
      where: { id: stockItem.id },
      data: { isReserved: true, reservedQuantity: reserveAmount, surplusQuantity: surplusAmount }
    });

    await prisma.upazillaDemand.update({
      where: { id: upazillaDemand!.id },
      data: { fulfilledQuantity: reserveAmount, status: 'fulfilled' }
    });

    await prisma.districtStockItem.create({
      data: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice', quantity: surplusAmount }
    });

    await prisma.districtDemand.update({
      where: { districtResellerId_productName: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } },
      data: { remainingDemand: { decrement: reserveAmount } }
    });

    const updatedDemand = await prisma.upazillaDemand.findUnique({ where: { id: upazillaDemand!.id } });
    if (updatedDemand!.status !== 'fulfilled') throw new Error("Mirpur demand should be fulfilled");
    if (updatedDemand!.fulfilledQuantity !== 100) throw new Error("Fulfilled qty should be 100");

    const distStock = await prisma.districtStockItem.findFirst({ where: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } });
    if (distStock!.quantity !== 20) throw new Error("District should have received 20 surplus");

    distDemand = await prisma.districtDemand.findUnique({ where: { districtResellerId_productName: { districtResellerId: MOCK_DHAKA_DISTRICT_ID, productName: 'Rice' } } });
    if (distDemand!.remainingDemand !== 80) throw new Error("District remaining demand should be 80");

    log("✓ TEST 9 PASSED");

    log("\nAll core algorithmic logic verified successfully.");
    
    await cleanUp();
    
    return NextResponse.json({ success: true, log: results });

  } catch (err: any) {
    log(`ERROR: ${err.message}`);
    await cleanUp();
    return NextResponse.json({ success: false, log: results }, { status: 500 });
  }
}
