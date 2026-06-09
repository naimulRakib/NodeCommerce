const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// 1. Profile: add shipmentPlans ShipmentPlan[]
schema = schema.replace(
  /orders\s+Order\[\]\s*\n\s*stockOrders\s+StockOrderNegotiation\[\]/g,
  "orders        Order[]\n  stockOrders   StockOrderNegotiation[]\n  shipmentPlans ShipmentPlan[]"
);

// 2. SellerProduct: add forecasts StockForecast[]
schema = schema.replace(
  /globalProduct\s*GlobalProduct\?\s*@relation\(fields:\s*\[globalProductId\],\s*references:\s*\[id\]\)/g,
  "globalProduct   GlobalProduct? @relation(fields: [globalProductId], references: [id])\n  forecasts       StockForecast[]"
);

// 3. Replace ACORoutingJob
const acoJobRegex = /model ACORoutingJob \{[\s\S]*?\n\}/;
const newACORoutingJob = `model ACORoutingJob {
  id                  String   @id @default(cuid())
  triggeredBy         String
  triggerType         String
  // "manual" | "automatic" | "forecast_confirmed"
  sourceUpazilla      String
  sourceSellerId      String
  productScope        String[]
  // array of productNames being routed
  // (multiple products per job)
  totalForecastedStock Json
  // { productName: quantity } map
  phase1Summary       Json     @default("{}")
  phase2Summary       Json     @default("{}")
  phase3Summary       Json     @default("{}")
  phase4Summary       Json     @default("{}")
  phase5Summary       Json     @default("{}")
  status              String   @default("planning")
  // planning | plan_ready | dispatched
  // | partially_delivered | completed | failed
  conservationCheck   Json?
  // verification result per product
  startedAt           DateTime @default(now())
  completedAt         DateTime?
  errorMessage        String?
  shipmentPlans       ShipmentPlan[]
  // one plan per destination truck

  @@index([status])
  @@index([sourceUpazilla])
}`;
schema = schema.replace(acoJobRegex, newACORoutingJob);

// 4. Replace InterDistrictOpportunity
const idoRegex = /model InterDistrictOpportunity \{[\s\S]*?\n\}/;
const newIDO = `model InterDistrictOpportunity {
  id               String           @id @default(cuid())
  jobId            String
  job              ACORoutingJob    @relation(
                     fields: [jobId],
                     references: [id])
  sourceDistrictId String
  sourceDist       DistrictReseller @relation(
                     "ACOSource",
                     fields: [sourceDistrictId],
                     references: [id])
  targetDistrictId String
  targetDist       DistrictReseller @relation(
                     "ACOTarget",
                     fields: [targetDistrictId],
                     references: [id])
  lineItems        Json
  // [{ productName, quantity, acoScore }]
  // multiple products per inter-district truck
  totalQuantity    Int
  overallAcoScore  Float
  distanceKm       Float
  sourceApproved   Boolean  @default(false)
  targetApproved   Boolean  @default(false)
  sourceApprovedAt DateTime?
  targetApprovedAt DateTime?
  status           String   @default("pending_approval")
  // pending_approval | both_approved
  // | source_rejected | target_rejected
  // | executed | expired
  expiresAt        DateTime
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([status])
}`;
schema = schema.replace(idoRegex, newIDO);

// 5. Append new models
const newModels = `

model StockForecast {
  id                 String   @id @default(cuid())
  sellerProductId    String
  sellerProduct      SellerProduct @relation(
                       fields: [sellerProductId],
                       references: [id])
  predictedQuantity  Int
  // seller's predicted available stock
  // entered before physical stock exists
  historicalBasis    Int      @default(0)
  // quantity from historical sales data
  manualAdjustment   Int      @default(0)
  // manual override added on top
  confidence         Float    @default(0.8)
  // 0.0 to 1.0
  forecastPeriodStart DateTime
  forecastPeriodEnd   DateTime
  status             String   @default("draft")
  // draft | confirmed | routing_planned
  // | dispatched | completed
  enteredBy          String
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  routingPlans       ShipmentPlan[]
}

model ShipmentPlan {
  id               String   @id @default(cuid())
  forecastId       String?
  forecast         StockForecast? @relation(
                     fields: [forecastId],
                     references: [id])
  sourceUpazilla   String
  sourceSellerId   String
  sourceSeller     Profile  @relation(
                     fields: [sourceSellerId],
                     references: [id])
  destinationType  String
  // "upazilla" | "district_hub"
  destinationId    String
  // upazillaResellerId or districtResellerId
  destinationName  String
  distanceKm       Float
  phase            Int
  // 1 | 2 | 3 | 4 | 5
  status           String   @default("planned")
  // planned | approved | dispatched
  // | delivered | failed | cancelled
  approvedBy       String?
  approvedAt       DateTime?
  dispatchedAt     DateTime?
  deliveredAt      DateTime?
  failedAt         DateTime?
  failureReason    String?
  lineItems        ShipmentLineItem[]
  truckId          String?
  // physical truck identifier if known
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  jobId            String?
  job              ACORoutingJob? @relation(fields: [jobId], references: [id])

  @@index([status])
  @@index([sourceUpazilla])
  @@index([destinationId])
}

model ShipmentLineItem {
  id              String       @id @default(cuid())
  shipmentPlanId  String
  shipment        ShipmentPlan @relation(
                    fields: [shipmentPlanId],
                    references: [id],
                    onDelete: Cascade)
  productName     String
  productCode     String?
  plannedQuantity Int
  // quantity in the ACO plan
  actualQuantity  Int?
  // confirmed quantity on delivery
  // null until delivered
  acoScore        Float
  demandAtTime    Int
  // demand when plan was made
  allocationPhase Int
  // which phase this product was allocated in
  status          String       @default("planned")
  // planned | delivered | short_delivered
  // | lost_in_transit
  createdAt       DateTime     @default(now())
}
`;

schema += newModels;

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema updated successfully.');
