import { prisma } from "@/lib/prisma";

export async function trackBehaviour(buyerId: string | null, type: string, payload: any): Promise<void> {
  try {
    if (!buyerId) return;

    // Run asynchronously without blocking the main request
    Promise.resolve().then(async () => {
      try {
        const buyerExists = await prisma.buyerProfile.findUnique({
          where: { id: buyerId },
          select: { id: true }
        });

        if (buyerExists) {
          await prisma.buyerBehaviour.create({
            data: {
              buyerId,
              type,
              payload: payload || {}
            }
          });
        }
      } catch (err) {
        console.error("Async behaviour tracking failed silently:", err);
      }
    });
  } catch (error) {
    // Never throw behaviour tracking errors
  }
}
