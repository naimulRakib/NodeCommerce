import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const sellerProducts = await prisma.sellerProduct.findMany({
      where: { status: 'approved' }
    });

    for (const sp of sellerProducts) {
      const randomStock = Math.floor(Math.random() * 4000) + 1000;
      await prisma.sellerProduct.update({
        where: { id: sp.id },
        data: { stock: randomStock }
      });
    }

    return NextResponse.json({ ok: true, message: `Randomized stock for ${sellerProducts.length} approved products.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
