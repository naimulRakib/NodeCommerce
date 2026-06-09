import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/district-reseller/profile
 *
 * Returns the district reseller's own profile row plus their email. The
 * `DistrictReseller` table is intentionally minimal (id, email, district,
 * createdAt) — district resellers do not have a richer public profile
 * like local resellers do, but this endpoint exists so the frontend has
 * a stable place to fetch the session-bound profile.
 */
export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "district_reseller");
    if (roleError) return roleError;

    const profile = await prisma.districtReseller.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile, email: user.email });
  } catch (error: any) {
    console.error("Failed to fetch district profile:", error);
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/district-reseller/profile
 *
 * DistrictReseller is intentionally minimal — there are no user-editable
 * fields beyond what's stored. The `district` column is `@@unique` (one
 * reseller per district) and is set at registration time, so we don't
 * expose it for editing here. This endpoint is kept so the frontend
 * has a stable place to POST profile updates if/when fields are added.
 */
export async function PATCH(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "district_reseller");
    if (roleError) return roleError;

    // No editable fields on DistrictReseller today. Return the current
    // row so callers can no-op the request without erroring.
    const profile = await prisma.districtReseller.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile, email: user.email });
  } catch (error: any) {
    console.error("Failed to update district profile:", error);
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) || "Internal server error" },
      { status: 500 }
    );
  }
}
