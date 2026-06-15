import { prisma } from "./src/lib/prisma";

async function main() {
  const dhakaDistrict = await prisma.districtReseller.findFirst({ where: { district: "Dhaka" }});
  const dhakaDemand = await prisma.districtDemand.findMany({ where: { districtResellerId: dhakaDistrict?.id }});
  const dhakaUpazillaDemand = await prisma.upazillaDemand.findMany();
  
  console.log("Dhaka Demand:", dhakaDemand);
  console.log("Upazilla Demand:", dhakaUpazillaDemand);

}

main().catch(console.error).finally(()=>prisma.$disconnect());
