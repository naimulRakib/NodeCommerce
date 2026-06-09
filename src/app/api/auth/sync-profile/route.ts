import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase-server";
import { profileDataFromUser } from "@/lib/profileFromUser";
import { ensureSellerCode } from "@/lib/ensure-seller-code";
import { generateSellerCode, generateResellerCode } from "@/lib/codes";
import { syncProfileToSupabaseAuth } from "@/lib/sync-profile-supabase";

/**
 * POST /api/auth/sync-profile
 *
 * Server-side role-aware profile sync. The client doesn't need to know which
 * role it is — the server reads the Supabase session, finds the matching row
 * across all role tables, and upserts the profile in the right place.
 *
 * Replaces the hardcoded `POST /api/seller/register` calls that used to break
 * for buyers, district-, upazilla-, and local-resellers.
 */
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = data.user;
    const userId = user.id;
    const profileFields = profileDataFromUser(user);

    // 1. Seller (Profile table)
    const existingSeller = await prisma.profile.findUnique({
      where: { id: userId },
    });
    if (existingSeller) {
      const updated = await prisma.profile.update({
        where: { id: userId },
        data: profileFields,
      });
      const ensured = await ensureSellerCode(updated);
      await syncProfileToSupabaseAuth(supabase, ensured);
      return NextResponse.json({ role: "seller", profile: ensured });
    }

    // 2. Buyer (BuyerProfile table)
    const existingBuyer = await prisma.buyerProfile.findUnique({
      where: { id: userId },
    });
    if (existingBuyer) {
      const updated = await prisma.buyerProfile.update({
        where: { id: userId },
        data: {
          fullName: (user.user_metadata as any)?.full_name ?? existingBuyer.fullName,
          phone: (user.user_metadata as any)?.phone ?? existingBuyer.phone,
        },
      });
      return NextResponse.json({ role: "buyer", profile: updated });
    }

    // 3. Local reseller
    const existingLocal = await prisma.localReseller.findUnique({
      where: { id: userId },
    });
    if (existingLocal) {
      // The local_reseller model has its own required columns (resellerCode,
      // email, fullName, etc.) — only update safe-to-overwrite fields.
      const updated = await prisma.localReseller.update({
        where: { id: userId },
        data: { fullName: existingLocal.fullName }, // no-op touch
      });
      return NextResponse.json({ role: "local_reseller", profile: updated });
    }

    // 4. Upazilla reseller — schema has no fullName column on this model,
    //    so a no-op read is sufficient for sync.
    const existingUpazilla = await prisma.upazillaReseller.findUnique({
      where: { id: userId },
    });
    if (existingUpazilla) {
      return NextResponse.json({
        role: "upazilla_reseller",
        profile: existingUpazilla,
      });
    }

    // 5. District reseller — same: read-only sync, no editable columns yet.
    const existingDistrict = await prisma.districtReseller.findUnique({
      where: { id: userId },
    });
    if (existingDistrict) {
      return NextResponse.json({
        role: "district_reseller",
        profile: existingDistrict,
      });
    }

    // 6. No existing row anywhere → create a seller profile as the default
    //    (matches the historical behavior of /api/seller/register).
    const created = await prisma.profile.create({
      data: {
        id: userId,
        type: "seller",
        sellerCode: await generateSellerCode(),
        ...profileFields,
      },
    });
    const ensured = await ensureSellerCode(created);
    await syncProfileToSupabaseAuth(supabase, ensured);
    return NextResponse.json({ role: "seller", profile: ensured });
  } catch (err: any) {
    console.error("sync-profile error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to sync profile" },
      { status: 500 },
    );
  }
}
