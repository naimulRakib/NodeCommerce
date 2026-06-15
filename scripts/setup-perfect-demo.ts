import { prisma } from "../src/lib/prisma";
import crypto from "crypto";

async function main() {
  console.log("Setting up perfect 4-phase ACO demo...");

  await prisma.aCOGlobalJob.deleteMany({});
  await prisma.localDemand.deleteMany({});
  await prisma.upazillaDemand.deleteMany({});
  await prisma.districtDemand.deleteMany({});
  await prisma.sellerProduct.updateMany({ data: { stock: 0 } });
  await prisma.upazillaStockItem.deleteMany({});
  await prisma.districtStockItem.deleteMany({});

  let dhakaDistrict = await prisma.districtReseller.findFirst({ where: { district: { contains: "dhaka", mode: "insensitive" } } });
  if (!dhakaDistrict) {
      dhakaDistrict = await prisma.districtReseller.create({
          data: { id: crypto.randomUUID(), email: "district.dhaka@demo.com", district: "Dhaka" }
      });
  }
  
  const cumillaDistrict = await prisma.districtReseller.findFirst({ where: { district: { contains: "cumilla", mode: "insensitive" } } });

  const dhakaUpazilla = await prisma.upazillaReseller.findFirst({ where: { city: "Dhaka" } });
  const cumillaUpazilla = await prisma.upazillaReseller.findFirst({ where: { city: cumillaDistrict?.district } });

  const dhakaLocal = await prisma.localReseller.findFirst({ where: { upazilla: dhakaUpazilla?.upazilla } });
  const cumillaSeller = await prisma.profile.findFirst({ where: { upazilla: cumillaUpazilla?.upazilla, type: "seller" } });

  if (!dhakaDistrict || !cumillaDistrict || !dhakaLocal || !cumillaSeller) {
    throw new Error(`Missing nodes. DH: ${!!dhakaDistrict}, CU: ${!!cumillaDistrict}, DL: ${!!dhakaLocal}, CS: ${!!cumillaSeller}`);
  }

  const globalProduct = await prisma.globalProduct.findFirst();
  if (!globalProduct) throw new Error("No global products");

  const productName = "Demo Premium Rice";
  const productCode = "DEMO-RICE-001";

  await prisma.sellerProduct.create({
    data: {
      sellerId: cumillaSeller.id,
      globalProductId: globalProduct.id,
      productCode,
      customName: productName,
      stock: 10000,
      price: 50,
      status: "approved"
    }
  });

  await prisma.localDemand.create({
    data: { localResellerId: dhakaLocal.id, productName, productCode, demandQuantity: 5000, status: "pending" }
  });
  
  await prisma.upazillaDemand.create({
    data: { upazillaResellerId: dhakaUpazilla!.id, productName, demandQuantity: 5000, fulfilledQuantity: 0, status: "pending", enteredBy: "demo" }
  });

  await prisma.districtDemand.create({
    data: { districtResellerId: dhakaDistrict.id, productName, totalDemand: 5000, remainingDemand: 5000, status: "pending" }
  });

  console.log("Perfect demo conditions set! Cumilla has 10,000 units. Dhaka needs 5,000 units.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
