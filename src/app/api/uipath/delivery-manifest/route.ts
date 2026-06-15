import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/uipath/delivery-manifest
 * Triggers a real UiPath Orchestrator Job to generate a delivery manifest.
 * 
 * Requires Environment Variables:
 * - UIPATH_ORCHESTRATOR_URL
 * - UIPATH_TENANT_NAME
 * - UIPATH_CLIENT_ID
 * - UIPATH_USER_KEY
 * - UIPATH_RELEASE_KEY
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      shipmentId,
      phase,
      fromName,
      toName,
      totalQuantity,
      products = [],
      type = "dispatch",
    } = body;

    const {
      UIPATH_ORCHESTRATOR_URL,
      UIPATH_TENANT_NAME,
      UIPATH_CLIENT_ID,
      UIPATH_USER_KEY,
      UIPATH_RELEASE_KEY
    } = process.env;

    // Strict check for production configuration
    if (!UIPATH_ORCHESTRATOR_URL || !UIPATH_RELEASE_KEY || !UIPATH_CLIENT_ID) {
      return NextResponse.json(
        { 
          error: "UiPath Orchestrator is not configured. Please provide UIPATH_ORCHESTRATOR_URL, UIPATH_RELEASE_KEY, and authentication keys in .env.local for production use.",
          isDemoRemoved: true 
        }, 
        { status: 501 }
      );
    }

    // 1. Authenticate with UiPath to get Bearer Token
    // (Assuming standard UiPath Cloud OAuth flow)
    const authRes = await fetch("https://account.uipath.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: UIPATH_CLIENT_ID,
        refresh_token: UIPATH_USER_KEY,
      }),
    });

    if (!authRes.ok) {
      throw new Error(`UiPath Auth Failed: ${authRes.statusText}`);
    }

    const { access_token } = await authRes.json();

    // 2. Start the Job in Orchestrator
    const startJobRes = await fetch(`${UIPATH_ORCHESTRATOR_URL}/${UIPATH_TENANT_NAME}/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token}`,
        "X-UIPATH-OrganizationUnitId": process.env.UIPATH_FOLDER_ID || "1",
      },
      body: JSON.stringify({
        startInfo: {
          ReleaseKey: UIPATH_RELEASE_KEY,
          Strategy: "Specific",
          RobotIds: [],
          NoOfRobots: 1,
          InputArguments: JSON.stringify({
            in_ShipmentId: shipmentId,
            in_Phase: phase,
            in_FromName: fromName,
            in_ToName: toName,
            in_TotalQuantity: totalQuantity,
            in_Products: JSON.stringify(products),
            in_Type: type
          })
        }
      })
    });

    if (!startJobRes.ok) {
      const errText = await startJobRes.text();
      throw new Error(`Failed to start UiPath job: ${errText}`);
    }

    const jobData = await startJobRes.json();

    // 3. Log the job to database (Assuming a UiPathJob model exists or updating Shipment)
    // For now, we update the shipment status
    if (shipmentId && !shipmentId.startsWith("demo")) {
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: { 
          manifestJobId: jobData.value[0].Id.toString(),
          status: "manifest_processing"
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "UiPath job triggered successfully", 
      jobId: jobData.value[0].Id 
    });

  } catch (err: any) {
    console.error("[delivery-manifest] Production Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
