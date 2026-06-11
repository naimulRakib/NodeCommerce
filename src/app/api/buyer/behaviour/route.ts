import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { trackBehaviour } from "@/lib/behaviour";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        const body = await req.json();
        const { type, payload, buyerId: providedBuyerId } = body;

        let finalBuyerId = user?.id || providedBuyerId || null;

        if (finalBuyerId) {
            // Verify BuyerProfile exists to prevent Prisma FK violations
            const bp = await prisma.buyerProfile.findUnique({ where: { id: finalBuyerId } });
            if (!bp) {
                finalBuyerId = null;
            }
        }

        if (finalBuyerId) {
            await trackBehaviour(finalBuyerId, type, payload);
        }
        
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Behaviour route failed silently:", e);
        return NextResponse.json({ success: false });
    }
}
