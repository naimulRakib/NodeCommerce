import { prisma } from "./prisma";
import type { RealtimeAction } from "@/generated/prisma";

export async function createRealtimeAction(params: {
  userId: string;
  userRole: string;
  actionType: string;
  title: string;
  message: string;
  metadata: object;
  priority: "urgent" | "normal" | "info";
  requiresAction: boolean;
  expiresAt?: Date;
}): Promise<RealtimeAction | null> {
  try {
    return await prisma.realtimeAction.create({
      data: {
        userId: params.userId,
        userRole: params.userRole,
        actionType: params.actionType,
        title: params.title,
        message: params.message,
        metadata: params.metadata ?? {},
        priority: params.priority,
        requiresAction: params.requiresAction,
        expiresAt: params.expiresAt,
      },
    });
  } catch (error) {
    console.error("[RealtimeNotifier] Failed to create action silently:", error);
    return null;
  }
}
