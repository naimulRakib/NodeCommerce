import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "buyer");
    if (roleError) return roleError;


    const profile = await prisma.buyerProfile.findUnique({
        where: { id: user.id }
    });

    if (!profile) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ profile });
}

export async function PATCH(req: Request) {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "buyer");
    if (roleError) return roleError;


    const body = await req.json();
    const { fullName, phone, address, city, district, upazilla, lat, lng, avatarUrl } = body;

    const profile = await prisma.buyerProfile.update({
        where: { id: user.id },
        data: {
            fullName,
            phone,
            address,
            city,
            district,
            upazilla,
            lat: lat ? parseFloat(lat) : null,
            lng: lng ? parseFloat(lng) : null,
            avatarUrl
        }
    });

    return NextResponse.json({ profile });
}
