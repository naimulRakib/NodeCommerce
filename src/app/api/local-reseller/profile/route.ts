import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { validateLocalResellerProfilePatch } from "@/lib/validate-local-reseller-profile";

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
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "local_reseller");
    if (roleError) return roleError;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    let data;
    try {
      data = validateLocalResellerProfilePatch(body);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Validation failed" },
        { status: 400 }
      );
    }

    const updatedProfile = await prisma.$transaction(async (tx) => {
      return tx.localReseller.update({
        where: { id: user.id },
        data,
      });
    });

    return NextResponse.json({ profile: updatedProfile });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) || "Internal server error" },
      { status: 500 }
    );
  }
}
