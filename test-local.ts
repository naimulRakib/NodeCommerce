import { NextRequest } from "next/server";
import { POST } from "./src/app/api/aco/global-trigger/route";
import { prisma } from "./src/lib/prisma";

async function main() {
  const sellerProducts = await prisma.sellerProduct.findMany({
    where: { status: "approved" },
    include: { seller: true, globalProduct: true }
  });
  const productNames = Array.from(new Set(sellerProducts.map(sp => sp.customName || sp.globalProduct?.name).filter(Boolean)));
  const user = await prisma.districtReseller.findFirst();

  const req = new NextRequest("http://localhost:3000/api/aco/global-trigger", {
    method: "POST",
    headers: { "x-test-bypass": "true" },
    body: JSON.stringify({ productScope: productNames, triggerType: "manual" })
  });

  const res = await POST(req as any);
  console.log(await res.json());
}
main().catch(console.error);
