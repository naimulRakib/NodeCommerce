
/**
 * PATCH /api/aco/shipments/[id]/approve
 *
 * Source or target district approval of a Phase 3
 * shipment. Body:
 *   {
 *     role: "source" | "target",
 *     decision: "approve" | "reject",
 *     reason?: string
 *   }
 *
 * State machine for a Phase 3 shipment:
 *   pending_approval
 *     -> source approves -> sourceApproved = true
 *     -> target approves -> targetApproved = true
 *     -> both approve    -> status = "approved" (and
 *        automatically triggers a Phase 4 dispatch by
 *        calling the same code path that the manual
 *        /api/aco/phase4-trigger would run)
 *     -> either rejects  -> status = "rejected",
 *        line items become "rejected"
 *
 * The "source" is the fromId district reseller. The
 * "target" is the toId district reseller. The caller
 * must be the head of one of those two districts, or
 * the super dashboard admin.
 *
 * Auth: a session is required; the actual district-head
 * check is enforced by matching the caller's profileId
 * against the relevant district reseller's profileId.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

interface PatchBody {
  role: "source" | "target";
  decision: "approve" | "reject";
  reason?: string;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth();
  if (error || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.role !== "source" && body.role !== "target") {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }
  if (body.decision !== "approve" && body.decision !== "reject") {
    return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  }

  // Authorize: the user must be the head of either the
  // source or the target district reseller. The existing
  // schema links a district reseller to a profileId; we
  // match against the caller's userId via the Profile
  // table.
  const shipment = await prisma.aCOShipment.findUnique({
    where: { id },
    include: { lineItems: true },
  });
  if (!shipment) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (shipment.phase !== 3) {
    return NextResponse.json(
      { error: "wrong_phase", message: "Only Phase 3 shipments require approval." },
      { status: 400 }
    );
  }
  if (shipment.status !== "pending_approval") {
    return NextResponse.json(
      { error: "not_pending", message: `Shipment is ${shipment.status}.` },
      { status: 400 }
    );
  }

  // Validate that the caller is a district reseller head.
  // The user.id maps to a User row; the DistrictReseller
  // row has a profileId that points to a Profile whose
  // userId is the caller.
  const districtReseller = await prisma.districtReseller.findUnique({
    where: { id: user.id },
    select: { id: true },
  });
  if (!districtReseller) {
    return NextResponse.json(
      { error: "not_district_head" },
      { status: 403 }
    );
  }
  const myDistrictResellerId = districtReseller.id;
  if (body.role === "source" && shipment.fromId !== myDistrictResellerId) {
    return NextResponse.json(
      { error: "not_source_head" },
      { status: 403 }
    );
  }
  if (body.role === "target" && shipment.toId !== myDistrictResellerId) {
    return NextResponse.json(
      { error: "not_target_head" },
      { status: 403 }
    );
  }

  // Apply the decision inside a serialized transaction.
  let updated;
  let autoPhase4Triggered = false;
  let executionError: string | null = null;

  try {
    updated = await prisma.$transaction(async (tx) => {
      // 1. Lock the row to serialize concurrent approvals (EC28)
      await tx.$executeRaw`SELECT 1 FROM "ACOShipment" WHERE id = ${id} FOR UPDATE`;
      
      // 2. Fetch latest state
      const currentShipment = await tx.aCOShipment.findUnique({
        where: { id },
        include: { lineItems: true }
      });
      if (!currentShipment || currentShipment.status !== "pending_approval") {
        throw new Error("Shipment is no longer pending approval.");
      }

      // 3. Compute flags
      const now = new Date();
      const data: any = {};
      if (body.role === "source") {
        data.sourceApproved = body.decision === "approve";
        data.sourceApprovedAt = body.decision === "approve" ? now : null;
        if (body.decision === "reject") {
          data.failureReason = body.reason ?? "rejected by source";
        }
      } else {
        data.targetApproved = body.decision === "approve";
        data.targetApprovedAt = body.decision === "approve" ? now : null;
        if (body.decision === "reject") {
          data.failureReason = body.reason ?? "rejected by target";
        }
      }

      const sourceApproved = body.role === "source" ? data.sourceApproved : currentShipment.sourceApproved;
      const targetApproved = body.role === "target" ? data.targetApproved : currentShipment.targetApproved;

      if (body.decision === "reject" || !sourceApproved || !targetApproved) {
        data.status = body.decision === "reject" ? "rejected" : "pending_approval";
      } else {
        data.status = "approved";
        data.dispatchedAt = currentShipment.dispatchedAt ?? now;
      }

      if (data.status === "approved") {
        autoPhase4Triggered = true;
        // Verify stock for each line item
        for (const li of currentShipment.lineItems) {
          if (!li.sellerProductId) continue;
          const sp = await tx.sellerProduct.findUnique({
            where: { id: li.sellerProductId },
            select: { stock: true, globalProduct: { select: { name: true } }, customName: true },
          });
          if (!sp) throw new Error(`Product missing: ${li.productName}`);
          if (sp.stock < li.allocatedQty) {
            const name = sp.globalProduct?.name ?? sp.customName ?? li.productName;
            throw new Error(
              JSON.stringify({
                type: "INSUFFICIENT_STOCK",
                message: `Execution failed: Insufficient stock for ${name} (requested: ${li.allocatedQty}, available: ${sp.stock}). All approvals reset. Please approve again.`
              })
            );
          }
        }

        // Stock verified, perform deductions
        for (const li of currentShipment.lineItems) {
          if (!li.sellerProductId) continue;
          await tx.sellerProduct.update({
            where: { id: li.sellerProductId },
            data: { stock: { decrement: li.allocatedQty } },
          });

          // Also decrement DistrictDemand for target
          const dDemand = await tx.districtDemand.findFirst({
            where: {
              districtResellerId: currentShipment.toId,
              productName: { equals: li.productName, mode: "insensitive" },
            },
          });
          if (dDemand) {
            const newRem = Math.max(0, dDemand.remainingDemand - li.allocatedQty);
            await tx.districtDemand.update({
              where: { id: dDemand.id },
              data: {
                remainingDemand: newRem,
                status: newRem <= 0 ? "fulfilled" : "partially_fulfilled",
              },
            });
          }
        }

        await tx.aCOShipmentItem.updateMany({
          where: { shipmentId: id },
          data: { status: "dispatched" },
        });
      }

      if (data.status === "rejected") {
        await tx.aCOShipmentItem.updateMany({
          where: { shipmentId: id },
          data: { status: "rejected" },
        });
      }

      return await tx.aCOShipment.update({
        where: { id },
        data,
        include: { lineItems: true },
      });
    });
  } catch (error: any) {
    if (error.message && error.message.includes("INSUFFICIENT_STOCK")) {
      try {
        const parsed = JSON.parse(error.message);
        executionError = parsed.message;
      } catch {
        executionError = error.message;
      }
    } else {
      return NextResponse.json({ error: "execution_error", message: error.message }, { status: 400 });
    }
  }

  if (executionError) {
    // Reset approvals on fallback
    const resetData = {
      sourceApproved: false,
      targetApproved: false,
      sourceApprovedAt: null,
      targetApprovedAt: null,
      status: "pending_approval",
      failureReason: "Insufficient stock during execution",
    };
    await prisma.aCOShipment.update({
      where: { id },
      data: resetData,
    });
    return NextResponse.json(
      { error: "execution_failed", message: executionError },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    shipment: updated,
    autoPhase4Triggered,
  });
}
