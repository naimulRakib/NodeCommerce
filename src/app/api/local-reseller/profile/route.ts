import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "local_reseller");
    if (roleError) return roleError;


    const profile = await prisma.localReseller.findUnique({
      where: { id: user.id }
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile, email: user.email });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "local_reseller");
    if (roleError) return roleError;


    const body = await req.json();
    const allowedUpdates: any = {};
    const updatableFields = ["fullName", "phone", "bio", "username", "city", "upazilla", "lat", "lng", "avatarUrl"];
    
    updatableFields.forEach(field => {
      if (body[field] !== undefined) {
        allowedUpdates[field] = body[field];
      }
    });

    const updatedProfile = await prisma.localReseller.update({
      where: { id: user.id },
      data: allowedUpdates
    });

    return NextResponse.json({ profile: updatedProfile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
