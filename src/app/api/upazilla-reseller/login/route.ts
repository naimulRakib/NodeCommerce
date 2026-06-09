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

    // Check if this user already has a reseller record
    const existing = await prisma.upazillaReseller.findUnique({
      where: { id: user.id },
    });

    if (existing) {
      // User already registered — just update city/upazilla if they changed
      // (the city+upazilla combo belongs to this user so it's safe to update)
      const reseller = await prisma.upazillaReseller.update({
        where: { id: user.id },
        data: { city, upazilla },
      });
      return NextResponse.json({ reseller });
    }

    // New user — check if that city+upazilla slot is already taken by someone else
    const takenSlot = await prisma.upazillaReseller.findUnique({
      where: { city_upazilla: { city, upazilla } },
    });

    if (takenSlot) {
      return NextResponse.json(
        {
          error: `The upazilla "${upazilla}" in "${city}" already has a registered reseller. Each upazilla can only have one reseller account.`,
        },
        { status: 409 }
      );
    }

    // Safe to create
    const reseller = await prisma.upazillaReseller.create({
      data: {
        id: user.id,
        email: user.email!,
        city,
        upazilla,
      },
    });

    return NextResponse.json({ reseller });
  } catch (error: any) {
    console.error("Upazilla Reseller Login API Error:", error);
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) || "Internal server error" },
      { status: 500 }
    );
  }
}

