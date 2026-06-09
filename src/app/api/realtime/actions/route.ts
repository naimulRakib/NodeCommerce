import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mock user context extractor for demo
function getMockUser(request: Request) {
  return { id: "mock-user-123" };
}

export async function GET(request: Request) {
  try {
    const user = getMockUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const requiresActionOnly = searchParams.get("requiresAction") === "true";
    const actionType = searchParams.get("type");

    const whereClause: any = { userId: user.id };

    if (unreadOnly) {
      whereClause.isRead = false;
    }
    if (requiresActionOnly) {
      whereClause.requiresAction = true;
      whereClause.isActioned = false;
    }
    if (actionType) {
      whereClause.actionType = actionType;
    }

    const [actions, unreadCount, urgentCount, pendingActionCount] = await Promise.all([
      prisma.realtimeAction.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.realtimeAction.count({
        where: { userId: user.id, isRead: false },
      }),
      prisma.realtimeAction.count({
        where: { userId: user.id, priority: "urgent", isActioned: false },
      }),
      prisma.realtimeAction.count({
        where: { userId: user.id, requiresAction: true, isActioned: false },
      }),
    ]);

    return NextResponse.json({
      actions,
      unreadCount,
      urgentCount,
      pendingActionCount,
    });
  } catch (error: any) {
    console.error("GET RealtimeActions error:", error);
    return NextResponse.json({ error: "Failed to fetch actions" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = getMockUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { ids, markRead, markActioned } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (typeof markRead === "boolean") dataToUpdate.isRead = markRead;
    if (typeof markActioned === "boolean") dataToUpdate.isActioned = markActioned;

    await prisma.realtimeAction.updateMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
      data: dataToUpdate,
    });

    // Return new counts
    const [unreadCount, urgentCount, pendingActionCount] = await Promise.all([
      prisma.realtimeAction.count({
        where: { userId: user.id, isRead: false },
      }),
      prisma.realtimeAction.count({
        where: { userId: user.id, priority: "urgent", isActioned: false },
      }),
      prisma.realtimeAction.count({
        where: { userId: user.id, requiresAction: true, isActioned: false },
      }),
    ]);

    return NextResponse.json({
      unreadCount,
      urgentCount,
      pendingActionCount,
    });
  } catch (error: any) {
    console.error("PATCH Bulk RealtimeActions error:", error);
    return NextResponse.json({ error: "Failed to update actions" }, { status: 500 });
  }
}
