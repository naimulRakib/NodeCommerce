import { ACOShipment, ACOShipmentItem } from "@/generated/prisma";
import { UIPATH_WEBHOOK_URL, UIPATH_API_KEY } from "@/lib/env";

export interface UiPathTriggerPayload {
  ShipmentId: string;
  TruckCode: string;
  ProductSummary: string;
  TotalQuantity: number;
  TotalWeightKg: number;
  TotalVolumeCBM: number;
  FromDistrict: string;
  ToDistrict: string;
  DistanceKm: number;
  CombinedScore: number;
  SourceEmail: string;
  TargetEmail: string;
  SourcePhone: string;
  TargetPhone: string;
  SourceDistrictId: string;
  TargetDistrictId: string;
  DriverName: string;
  DriverPhone: string;
  LicensePlate: string;
  TransportAgency: string;
  AgencyBookingRef: string;
  NegotiatedMaxPrice: number;
  ConfirmedFreight: number;
  ExpiresAt: string;
  RequiredByDate: string;
  CallbackUrl: string;
  SeasonalRiskFlag: string;
  HistoricalDelayRate: number;
  CurrentWeather: string;
}

/**
 * Trigger the external UiPath Agent via Webhook.
 */
export async function triggerUiPathAgent(payload: UiPathTriggerPayload) {
  if (!UIPATH_WEBHOOK_URL) {
    console.warn("[UiPath] UIPATH_WEBHOOK_URL not set. Skipping UiPath trigger.");
    return false;
  }

  try {
    const res = await fetch(UIPATH_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${UIPATH_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("[UiPath] Webhook failed:", res.status, await res.text());
      return false;
    }

    console.log("[UiPath] Successfully triggered Action Center for shipment", payload.ShipmentId);
    return true;
  } catch (error) {
    console.error("[UiPath] Webhook network error:", error);
    return false;
  }
}
