import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { 
      user: null, 
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) 
    };
  }
  return { user, error: null };
}

export async function requireRole(
  userId: string,
  role: "seller" | "buyer" | "local_reseller" | "upazilla_reseller" | "district_reseller"
) {
  try {
    let hasRole = false;
    switch (role) {
      case "seller":
        const seller = await prisma.profile.findFirst({ where: { id: userId } });
        hasRole = !!seller;
        break;
      case "buyer":
        const buyer = await prisma.buyerProfile.findUnique({ where: { id: userId } });
        hasRole = !!buyer;
        break;
      case "local_reseller":
        const local = await prisma.localReseller.findUnique({ where: { id: userId } });
        hasRole = !!local;
        break;
      case "upazilla_reseller":
        const upazilla = await prisma.upazillaReseller.findUnique({ where: { id: userId } });
        hasRole = !!upazilla;
        break;
      case "district_reseller":
        const district = await prisma.districtReseller.findUnique({ where: { id: userId } });
        hasRole = !!district;
        break;
    }

    if (!hasRole) {
      return { 
        hasRole: false, 
        error: NextResponse.json({ error: "Session conflict, please login again" }, { status: 403 }) 
      };
    }
    return { hasRole: true, error: null };
  } catch (err) {
    return {
      hasRole: false,
      error: NextResponse.json({ error: "Internal server error during role validation" }, { status: 500 })
    };
  }
}
