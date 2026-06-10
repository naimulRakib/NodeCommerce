import { triggerUiPathAgent } from "./src/lib/uipath";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function runTest() {
  console.log("Testing UiPath Webhook with URL:", process.env.UIPATH_WEBHOOK_URL);
  
  const payload = {
    ShipmentId: "TEST-SHP-001",
    TruckCode: "TRK-999",
    ProductSummary: "Test Payload from Antigravity",
    TotalQuantity: 10,
    TotalWeightKg: 50.5,
    TotalVolumeCBM: 2.0,
    FromDistrict: "Dhaka",
    ToDistrict: "Comilla",
    DistanceKm: 120.0,
    CombinedScore: 0.95,
    SourceEmail: "ops@test.com",
    TargetEmail: "target@test.com",
    SourcePhone: "01700000000",
    TargetPhone: "01700000000",
    SourceDistrictId: "dist_1",
    TargetDistrictId: "dist_2",
    DriverName: "Test Driver",
    DriverPhone: "01700000000",
    LicensePlate: "DHA-11-2233",
    TransportAgency: "Test 3PL",
    AgencyBookingRef: "REF-001",
    NegotiatedMaxPrice: 5000,
    ConfirmedFreight: 4800,
    ExpiresAt: new Date().toISOString(),
    RequiredByDate: new Date().toISOString(),
    CallbackUrl: "http://localhost:3000/api/uipath",
    SeasonalRiskFlag: "LOW",
    HistoricalDelayRate: 0.05,
    CurrentWeather: "Clear",
  };

  try {
    const res = await triggerUiPathAgent(payload);
    console.log("Trigger Result:", res);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

runTest();
