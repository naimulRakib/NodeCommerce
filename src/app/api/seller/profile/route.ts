import { NextResponse } from "next/server";
import { ensureSellerCode } from "@/lib/ensure-seller-code";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase-server";
import { syncProfileToSupabaseAuth } from "@/lib/sync-profile-supabase";
import { validateProfilePatch } from "@/lib/validate-profile-patch";

export async function GET() {
  const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "seller");
    if (roleError) return roleError;

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found. Complete seller registration first." },
      { status: 404 }
    );
  }

  const profileWithCode = await ensureSellerCode(profile);

  return NextResponse.json({
    profile: profileWithCode,
    email: user.email ?? null,
  });
}

export async function PATCH(request) {
  const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "seller");
    if (roleError) return roleError;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let data;
  try {
    data = validateProfilePatch(body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Validation failed" },
      { status: 400 }
    );
  }

  try {
    let profile = await prisma.profile.update({
      where: { id: user.id },
      data,
    });

    profile = await ensureSellerCode(profile);

    const supabase = await createClient();
    const authSyncError = await syncProfileToSupabaseAuth(supabase, profile);

    if (authSyncError) {
      console.warn("Supabase auth metadata sync failed:", authSyncError.message);
    }

    return NextResponse.json({
      profile,
      email: user.email ?? null,
      authSynced: !authSyncError,
    });
  } catch (err) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (err?.code === "P2022") {
      return NextResponse.json(
        {
          error:
            "Database schema is out of date. Run db/002_seller_dashboard_schema.sql or npx prisma db push.",
        },
        { status: 500 }
      );
    }

    console.error("Profile PATCH error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to update profile",
      },
      { status: 500 }
    );
  }
}
