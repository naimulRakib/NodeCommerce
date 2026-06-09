import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const sellerProducts = await prisma.sellerProduct.findMany({
      where: { status: 'approved' },
      select: { customName: true, globalProduct: { select: { name: true } } }
    });

    const productNames = Array.from(new Set(sellerProducts.map(sp => sp.customName || sp.globalProduct?.name).filter(Boolean)));
    const user = await prisma.districtReseller.findFirst();

    const res = await fetch('http://localhost:3000/api/aco/global-trigger', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': `bypass_auth_id=${user?.id}`
      },
      body: JSON.stringify({ productScope: productNames, triggerType: 'manual' })
    });
    
    const data = await res.json();
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
