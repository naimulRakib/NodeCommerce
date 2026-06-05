import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { city, upazilla } = body;

    if (!city || !upazilla) {
      return NextResponse.json({ error: "City and Upazilla are required" }, { status: 400 });
    }

    const reseller = await prisma.upazillaReseller.upsert({
      where: { id: user.id },
      update: { city, upazilla },
      create: {
        id: user.id,
        email: user.email!,
        city,
        upazilla,
      },
    });

    return NextResponse.json({ reseller });
  } catch (error: any) {
    console.error("Upazilla Reseller Login API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
