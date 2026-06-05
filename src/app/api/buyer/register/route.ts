import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { id, email, fullName, phone, address, lat, lng, city, upazilla, district } = body;

    if (id !== user.id) {
      return NextResponse.json({ error: "Unauthorized user mapping" }, { status: 401 });
    }

    if (!email || !fullName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const profile = await prisma.buyerProfile.upsert({
      where: { id },
      update: {
        email,
        fullName,
        phone,
        address,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        city,
        upazilla,
        district,
      },
      create: {
        id,
        email,
        fullName,
        phone,
        address,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        city,
        upazilla,
        district,
      },
    });

    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error("Buyer registration error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
