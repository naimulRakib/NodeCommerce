import { NextRequest, NextResponse } from "next/server";
import { generateSellerCode } from "@/lib/codes";
import { ensureSellerCode } from "@/lib/ensure-seller-code";
import { profileDataFromUser } from "@/lib/profileFromUser";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase-server";
import { syncProfileToSupabaseAuth } from "@/lib/sync-profile-supabase";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or expired token" },
        { status: 401 }
      );
    }

    const profileFields = profileDataFromUser(data.user);
    const existing = await prisma.profile.findUnique({
      where: { id: data.user.id },
    });

    let profile = existing
      ? await prisma.profile.update({
          where: { id: data.user.id },
          data: profileFields,
        })
      : await prisma.profile.create({
          data: {
            id: data.user.id,
            type: "seller",
            sellerCode: await generateSellerCode(),
            ...profileFields,
          },
        });

    profile = await ensureSellerCode(profile);

    const authSyncError = await syncProfileToSupabaseAuth(supabase, profile);
    if (authSyncError) {
      console.warn("Supabase auth metadata sync failed:", authSyncError.message);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Profile synced successfully",
        profile,
      },
      { status: 200 }
    );
  } catch (prismaError) {
    console.error("Profile sync error:", prismaError);
    return NextResponse.json(
      { error: "Failed to sync profile in database" },
      { status: 500 }
    );
  }
}
