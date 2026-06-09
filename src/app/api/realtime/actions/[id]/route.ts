import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mock user context extractor for demo
function getMockUser(request: Request) {
  return { id: "mock-user-123" };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getMockUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { isRead, isActioned } = body;

    const action = await prisma.realtimeAction.findUnique({
      where: { id },
    });

    if (!action) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    if (action.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const dataToUpdate: any = {};
    if (typeof isRead === "boolean") dataToUpdate.isRead = isRead;
    if (typeof isActioned === "boolean") dataToUpdate.isActioned = isActioned;

    const updatedAction = await prisma.realtimeAction.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({ action: updatedAction });
  } catch (error: any) {
    console.error("PATCH Single RealtimeAction error:", error);
    return NextResponse.json({ error: "Failed to update action" }, { status: 500 });
  }
}
