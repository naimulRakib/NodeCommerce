import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // Edge Case 7: Webhook Secret Header Missing or Wrong
    const secret = req.headers.get("x-uipath-secret");
    const expectedSecret = process.env.UIPATH_WEBHOOK_SECRET || "default_test_secret";
    if (secret !== expectedSecret) {
      console.warn(`[UiPath Security] Unauthorized callback attempt. Invalid or missing secret.`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Edge Case 8: Malformed JSON in Callback Body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
    }

    const { shipmentId, actorDistrictId, action, note, uipathJobId, riskScore, overallRisk, requestId } = body;

    if (!shipmentId || !action || !actorDistrictId) {
      return NextResponse.json({ error: "shipmentId, actorDistrictId, and action are required" }, { status: 400 });
    }

    // Edge Case 5: Both Resellers Approve Simultaneously (Concurrency Control)
    const result = await prisma.$transaction(async (tx) => {
      // Lock the row to serialize concurrent callbacks
      const lockedShipments = await tx.$queryRaw<any[]>`
        SELECT "id", "status", "sourceApproved", "targetApproved", "fromId", "toId", "notes" 
        FROM "ACOShipment" 
        WHERE "id" = ${shipmentId} 
        FOR UPDATE
      `;

      if (!lockedShipments || lockedShipments.length === 0) {
        throw new Error("NOT_FOUND");
      }
      const shipment = lockedShipments[0];

      // Edge Cases 4 & 6: One Reseller Approves Then Shipment Cancelled / Expired
      if (shipment.status !== "pending_approval" && shipment.status !== "source_approved" && shipment.status !== "target_approved") {
        return { alreadyProcessed: true, message: `Shipment is no longer pending approval. Current status: ${shipment.status}` };
      }

      const isSource = shipment.fromId === actorDistrictId;
      const isTarget = shipment.toId === actorDistrictId;

      // Edge Case 10: actorDistrictId Does Not Match Shipment
      if (!isSource && !isTarget) {
        throw new Error("FORBIDDEN");
      }

      // Edge Case 3, 21, 22: Reseller Approves Twice / Idempotency / Concurrency
      if ((isSource && shipment.sourceApproved && action === "approve") || 
          (isTarget && shipment.targetApproved && action === "approve")) {
        
        // If we have a requestId and it's already in the notes, it's a network retry (Edge Case 21)
        if (requestId && shipment.notes && shipment.notes.includes(requestId)) {
          return { alreadyProcessed: true, message: "Idempotent retry detected." };
        }
        
        // Otherwise it's a concurrent submission from another user (Edge Case 22)
        throw new Error("CONFLICT");
      }

      // Prepare update data
      let updateData: any = { uipathJobId, riskScore, overallRisk };
      let newNotes = shipment.notes ? shipment.notes + `\nUiPath [${actorDistrictId}]: ${note}` : `UiPath [${actorDistrictId}]: ${note}`;
      if (requestId) newNotes += ` (Req:${requestId})`;
      updateData.notes = newNotes;

      if (action === "reject") {
        updateData.status = isSource ? "source_rejected" : "target_rejected";
        updateData.failureReason = note;
      } else if (action === "approve") {
        if (isSource) {
          updateData.sourceApproved = true;
          updateData.sourceApprovedAt = new Date();
          if (shipment.targetApproved) {
            updateData.status = "both_approved";
            updateData.dispatchedAt = new Date();
          } else {
            updateData.status = "source_approved";
          }
        } else if (isTarget) {
          updateData.targetApproved = true;
          updateData.targetApprovedAt = new Date();
          if (shipment.sourceApproved) {
            updateData.status = "both_approved";
            updateData.dispatchedAt = new Date();
          } else {
            updateData.status = "target_approved";
          }
        }
      }

      const updated = await tx.aCOShipment.update({
        where: { id: shipmentId },
        data: updateData,
      });

      return { success: true, status: updated.status };
    });

    if (result.alreadyProcessed) {
      return NextResponse.json(result);
    }
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("[UiPath Approval Hook] Error:", error);
    if (error.message === "NOT_FOUND") return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Actor is neither source nor target for this shipment" }, { status: 403 });
    if (error.message === "CONFLICT") return NextResponse.json({ error: "District has already submitted a decision." }, { status: 409 });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
