import { prisma } from "./src/lib/prisma";

async function main() {
  const dhakaDistrict = await prisma.districtReseller.findFirst({ where: { district: "Dhaka" }});
  const dhakaDemand = await prisma.districtDemand.findMany({ where: { districtResellerId: dhakaDistrict?.id }});
  const sellerProducts = await prisma.sellerProduct.findMany({ where: { status: "approved" }, include: { seller: true }});
  
  console.log("Dhaka Demand:", dhakaDemand);
  console.log("Seller Product:", sellerProducts.map(sp => ({ city: sp.seller.city, upazilla: sp.seller.upazilla, name: sp.customName, stock: sp.stock })));
}

main().catch(console.error).finally(()=>prisma.$disconnect());
