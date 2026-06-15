import { prisma } from "./src/lib/prisma";

async function main() {
  const sellerProducts = await prisma.sellerProduct.findMany({
    where: { status: "approved" },
    include: { seller: true, globalProduct: true }
  });
  const productNames = Array.from(new Set(sellerProducts.map(sp => sp.customName || sp.globalProduct?.name).filter(Boolean)));
  const user = await prisma.districtReseller.findFirst();

  const res = await fetch("http://localhost:3000/api/aco/global-trigger", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-test-bypass": "true"
    },
    body: JSON.stringify({ productScope: productNames, triggerType: "manual" })
  });
  
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
