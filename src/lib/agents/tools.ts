import { tool } from "@langchain/core/tools"
import { z } from "zod"

export const getDistrictStock = tool(
  async ({ districtId }) => {
    const res = await fetch(
      `${process.env.NODECOMMERCE_BASE_URL}/api/districts/${districtId}/stock`,
      { headers: { Authorization: `Bearer ${process.env.NODECOMMERCE_INTERNAL_KEY}` } }
    )
    if (!res.ok) throw new Error(`Stock fetch failed: ${res.status}`)
    return res.json()
  },
  {
    name: "get_district_stock",
    description: "Get current stock levels for all products in a district",
    schema: z.object({ districtId: z.string() })
  }
)

export const getSalesHistory = tool(
  async ({ districtId, productCode, days }) => {
    const res = await fetch(
      `${process.env.NODECOMMERCE_BASE_URL}/api/analytics/sales?districtId=${districtId}&productCode=${productCode}&days=${days}`,
      { headers: { Authorization: `Bearer ${process.env.NODECOMMERCE_INTERNAL_KEY}` } }
    )
    if (!res.ok) throw new Error(`Sales history fetch failed: ${res.status}`)
    return res.json()
  },
  {
    name: "get_sales_history",
    description: "Get daily sales data for a product in a district over the past N days. Returns quantities sold, revenue, and buyer counts per day.",
    schema: z.object({
      districtId: z.string(),
      productCode: z.string(),
      days: z.number().min(7).max(365)
    })
  }
)

export const getMarketPrices = tool(
  async ({ productCode }) => {
    const res = await fetch(
      `${process.env.NODECOMMERCE_BASE_URL}/api/market/prices?productCode=${productCode}`,
      { headers: { Authorization: `Bearer ${process.env.NODECOMMERCE_INTERNAL_KEY}` } }
    )
    if (!res.ok) throw new Error(`Market price fetch failed: ${res.status}`)
    return res.json()
  },
  {
    name: "get_market_prices",
    description: "Get current market prices and price trend for a product across all districts",
    schema: z.object({ productCode: z.string() })
  }
)

export const getWeatherForecast = tool(
  async ({ districtId, days }) => {
    const res = await fetch(
      `${process.env.NODECOMMERCE_BASE_URL}/api/weather?districtId=${districtId}&days=${days}`,
      { headers: { Authorization: `Bearer ${process.env.NODECOMMERCE_INTERNAL_KEY}` } }
    )
    if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`)
    return res.json()
  },
  {
    name: "get_weather_forecast",
    description: "Get weather forecast for a district for the next N days. Includes rain probability and flood risk.",
    schema: z.object({
      districtId: z.string(),
      days: z.number().min(1).max(14)
    })
  }
)

export const getUpcomingEvents = tool(
  async ({ districtId, days }) => {
    const res = await fetch(
      `${process.env.NODECOMMERCE_BASE_URL}/api/events/calendar?districtId=${districtId}&days=${days}`,
      { headers: { Authorization: `Bearer ${process.env.NODECOMMERCE_INTERNAL_KEY}` } }
    )
    if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`)
    return res.json()
  },
  {
    name: "get_upcoming_events",
    description: "Get upcoming local events, holidays, and festivals that affect demand. Includes Eid, Ramadan, harvest season, local fairs.",
    schema: z.object({
      districtId: z.string(),
      days: z.number().min(1).max(30)
    })
  }
)

export const getHistoricalShipments = tool(
  async ({ fromDistrict, toDistrict, days }) => {
    const res = await fetch(
      `${process.env.NODECOMMERCE_BASE_URL}/api/shipments/history?from=${fromDistrict}&to=${toDistrict}&days=${days}`,
      { headers: { Authorization: `Bearer ${process.env.NODECOMMERCE_INTERNAL_KEY}` } }
    )
    if (!res.ok) throw new Error(`Shipment history fetch failed: ${res.status}`)
    return res.json()
  },
  {
    name: "get_historical_shipments",
    description: "Get past shipment records between two districts with delay data and reliability scores",
    schema: z.object({
      fromDistrict: z.string(),
      toDistrict: z.string(),
      days: z.number()
    })
  }
)

export const postForecastResult = tool(
  async ({ agentName, forecastType, payload }) => {
    const res = await fetch(
      `${process.env.NODECOMMERCE_BASE_URL}/api/agent/forecasts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NODECOMMERCE_INTERNAL_KEY}`
        },
        body: JSON.stringify({ agentName, forecastType, payload, timestamp: new Date().toISOString() })
      }
    )
    if (!res.ok) throw new Error(`Forecast post failed: ${res.status}`)
    return res.json()
  },
  {
    name: "post_forecast_result",
    description: "Save a demand forecast or recommendation to NodeCommerce database",
    schema: z.object({
      agentName: z.string(),
      forecastType: z.string(),
      payload: z.record(z.any())
    })
  }
)

export const sharedTools = [
  getDistrictStock,
  getSalesHistory,
  getMarketPrices,
  getWeatherForecast,
  getUpcomingEvents,
  getHistoricalShipments,
  postForecastResult
]
