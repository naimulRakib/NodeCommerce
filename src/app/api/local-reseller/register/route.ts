import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { generateResellerCode } from "@/lib/codes";

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { id, email, username, lat, lng, city, upazilla } = body;

    if (!id || id !== user.id) {
      return NextResponse.json({ error: "User ID mismatch or missing" }, { status: 400 });
    }

    if (!email || !username || !city || !upazilla) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const resellerCode = await generateResellerCode();

    const reseller = await prisma.localReseller.upsert({
      where: { id },
      update: {
        email,
        username,
        lat,
        lng,
        city,
        upazilla,
      },
      create: {
        id,
        email,
        username,
        lat,
        lng,
        city,
        upazilla,
        resellerCode,
      },
    });

    return NextResponse.json(reseller);
  } catch (error: any) {
    console.error("Local Reseller Registration Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
