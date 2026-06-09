import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  const sellerProducts = await prisma.sellerProduct.findMany({
    where: { status: 'approved' },
    select: { customName: true, globalProduct: { select: { name: true } } }
  });

  const productNames = Array.from(new Set(sellerProducts.map(sp => sp.customName || sp.globalProduct?.name).filter(Boolean)));
  
  // Pick an arbitrary user to act as the triggerer
  const user = await prisma.districtReseller.findFirst() || await prisma.upazillaReseller.findFirst();
  if (!user) { throw new Error("No user found to bypass auth"); }

  console.log("Triggering Global ACO for products:", productNames.length, "products. User:", user.id);
  
  const res = await fetch('http://localhost:3000/api/aco/global-trigger', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': `bypass_auth_id=${user.id}`
    },
    body: JSON.stringify({ productScope: productNames, triggerType: 'manual' })
  });
  
  const data = await res.json();
  console.log("Global Trigger Result:", JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
