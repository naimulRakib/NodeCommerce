import { Annotation } from "@langchain/langgraph"

export interface SalesDataPoint {
  productCode: string
  productName: string
  districtId: string
  date: string
  quantitySold: number
  revenue: number
  buyerCount: number
}

export interface DemandForecast {
  productCode: string
  productName: string
  districtId: string
  forecastPeriodDays: number
  predictedDemand: number
  confidenceScore: number
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW"
  upperBound: number
  lowerBound: number
  forecastMethod: string
  keyDrivers: string[]
  seasonalFactor: number
  trendDirection: "INCREASING" | "STABLE" | "DECREASING"
  stockoutRiskDate: string | null
  recommendedStockLevel: number
  roiIfStocked: number
  roiIfStockout: number
}

export interface CriticalAlert {
  productCode: string
  districtId: string
  severity: "CRITICAL" | "WARNING" | "WATCH"
  message: string
  messageBangla: string
  predictedStockoutDate: string
  daysRemaining: number
  estimatedRevenueLoss: number
}

export interface RestockRecommendation {
  destinationDistrictId: string
  sourceDistrictId: string
  productCode: string
  quantityKg: number
  priority: "EMERGENCY" | "HIGH" | "NORMAL"
  reasonBangla: string
  expectedROI: number
  dispatchBy: string
  forecastConfidence: number
}

export interface ROIProjection {
  districtId: string
  productCode: string
  scenarioName: string
  revenueIfOptimalStock: number
  revenueIfCurrentStock: number
  revenueIfStockout: number
  recommendedInvestment: number
  projectedReturn: number
  roiPercentage: number
  paybackDays: number
}

export interface RunMetadata {
  startTime: string
  agentsRun: string[]
  totalTokensUsed: number
  langsmithRunId?: string
}

export const NodeCommerceState = Annotation.Root({

  districtId: Annotation<string>({
    reducer: (current, update) => update ?? current,
    default: () => ""
  }),

  triggerReason: Annotation<string>({
    reducer: (current, update) => update ?? current,
    default: () => "scheduled"
  }),

  stockSnapshot: Annotation<Record<string, number>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({})
  }),

  consumptionRates: Annotation<Record<string, number>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({})
  }),

  salesHistory: Annotation<SalesDataPoint[]>({
    reducer: (current, update) => update ?? current,
    default: () => []
  }),

  demandForecasts: Annotation<DemandForecast[]>({
    reducer: (current, update) => update ?? current,
    default: () => []
  }),

  criticalAlerts: Annotation<CriticalAlert[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),

  restockRecommendations: Annotation<RestockRecommendation[]>({
    reducer: (current, update) => update ?? current,
    default: () => []
  }),

  roiProjections: Annotation<ROIProjection[]>({
    reducer: (current, update) => update ?? current,
    default: () => []
  }),

  messages: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),

  errors: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),

  runMetadata: Annotation<RunMetadata>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({
      startTime: new Date().toISOString(),
      agentsRun: [],
      totalTokensUsed: 0
    })
  })
})

export type NodeCommerceStateType = typeof NodeCommerceState.State
