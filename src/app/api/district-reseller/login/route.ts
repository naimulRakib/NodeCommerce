import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { district } = body;

    if (!district || typeof district !== "string" || district.trim() === "") {
      return NextResponse.json({ error: "District is required" }, { status: 400 });
    }

    // Check if another DistrictReseller already owns this district and has a different id
    const existingReseller = await prisma.districtReseller.findFirst({
      where: {
        district,
        NOT: {
          id: user.id,
        },
      },
    });

    if (existingReseller) {
      // If the emails match, it means they are claiming a seeded account.
      // We can safely update the seeded account's ID to the real Auth ID.
      if (existingReseller.email === user.email) {
        await prisma.districtReseller.update({
          where: { id: existingReseller.id },
          data: { id: user.id }
        });
        
        return NextResponse.json({ reseller: existingReseller });
      }

      return NextResponse.json(
        { error: "This district already has a registered reseller." },
        { status: 403 }
      );
    }

    const reseller = await prisma.districtReseller.upsert({
      where: { id: user.id },
      update: { district },
      create: {
        id: user.id,
        email: user.email!,
        district,
      },
    });

    return NextResponse.json({ reseller });
  } catch (error: any) {
    console.error("District Reseller Login API Error:", error);
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) || "Internal server error" },
      { status: 500 }
    );
  }
}
