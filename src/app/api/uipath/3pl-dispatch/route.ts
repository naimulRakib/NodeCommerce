import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { shipmentId, forceOverBudget } = body;

    const shipment = await prisma.aCOShipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Agencies to try in order
    const agencies = [
      { name: "TruckLagbe", price: forceOverBudget ? 13000 : 11000, driver: "Agency1Driver", plate: "AA-1111" },
      { name: "Pathao Freight", price: forceOverBudget ? 14000 : 10500, driver: "Agency2Driver", plate: "BB-2222" },
      { name: "Kotha Logistics", price: forceOverBudget ? 12500 : 11800, driver: "Agency3Driver", plate: "CC-3333" }
    ];

    let bestAgency = null;
    let bestPrice = Infinity;

    // Simulate visiting agencies
    for (const agency of agencies) {
      // Log visit
      await prisma.mockThirdPartyAgencyLog.create({
        data: { agencyName: agency.name, shipmentId, status: "visited", quoteAmount: agency.price }
      });

      if (agency.price < bestPrice) {
        bestPrice = agency.price;
        bestAgency = agency;
      }
    }

    if (!bestAgency) {
      return NextResponse.json({ error: "No agencies available" }, { status: 400 });
    }

    // Confirm best agency
    await prisma.mockThirdPartyAgencyLog.create({
      data: { agencyName: bestAgency.name, shipmentId, status: "confirmed", quoteAmount: bestAgency.price }
    });

    const isOverBudget = bestPrice > (shipment.negotiatedMaxPrice || 12000);

    // Update shipment
    await prisma.aCOShipment.update({
      where: { id: shipmentId },
      data: {
        confirmedFreight: bestPrice,
        overBudgetFlag: isOverBudget,
        status: isOverBudget ? "pending_approval" : "truck_assigned",
        driverName: bestAgency.driver,
        licensePlate: bestAgency.plate
      }
    });

    // Handle Over Budget Task
    if (isOverBudget) {
      await prisma.mockActionCenterTask.create({
        data: {
          shipmentId,
          assignedTo: "ops_admin",
          type: "BUDGET_APPROVAL_REQUIRED",
          title: `OVER BUDGET APPROVAL: ${shipmentId}`,
          priority: "Urgent",
          status: "pending"
        }
      });
      
      await prisma.mockNotificationLog.create({
        data: {
          type: "email",
          recipient: "ops@nodecommerce.test",
          shipmentId,
          subject: `OVER BUDGET ALERT for ${shipmentId}. Best price: ${bestPrice}`,
          body: `Over budget alert`
        }
      });
    } else {
      await prisma.mockNotificationLog.create({
        data: {
          type: "email",
          recipient: "ops@nodecommerce.test",
          shipmentId,
          subject: `Booking confirmed for ${shipmentId}. Price: ${bestPrice}`,
          body: `Booking confirmed`
        }
      });
    }

    // Generate Mock Documents
    await prisma.mockDocument.createMany({
      data: [
        {
          shipmentId,
          filename: `${shipmentId}_WAYBILL.pdf`,
          content: `WAYBILL FOR ${shipmentId}\nDriver: ${bestAgency.driver}\nPlate: ${bestAgency.plate}\nFrom: ${shipment.fromName}\nTo: ${shipment.toName}\n[QR_CODE_IMAGE]\nEMERGENCY: TRUCK DOWN protocol active.`
        },
        {
          shipmentId,
          filename: `${shipmentId}_TRIPSHEET.pdf`,
          content: `TRIPSHEET FOR ${shipmentId}\nDriver: ${bestAgency.driver}\nDISTANCE: ${shipment.distanceKm} km\n` + 
                   Array.from({ length: Math.ceil((shipment.distanceKm || 0) / 100) }, (_, i) => `Check-in ${i+1}`).join("\n")
        },
        {
          shipmentId,
          filename: `${shipmentId}_TRANSFER_CERT.pdf`,
          content: `TRANSFER CERTIFICATE FOR ${shipmentId}\nApproval audit trail verified.\nUiPath Job ID: ${shipment.uipathJobId || 'mock-job-123'}`
        },
        {
          shipmentId,
          filename: `${shipmentId}_COST_REPORT.pdf`,
          content: `COST REPORT FOR ${shipmentId}\n` + 
                   agencies.map(a => `${a.name}: ${a.price} BDT - ${a.name === bestAgency?.name ? '[SELECTED]' : '[REJECTED]'}`).join("\n")
        }
      ]
    });

    return NextResponse.json({ success: true, selectedAgency: bestAgency.name, price: bestPrice });

  } catch (error: any) {
    console.error("[3PL Dispatch] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
