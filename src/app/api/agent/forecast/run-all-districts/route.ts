import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {

  const cronSecret = req.headers.get("CRON-SECRET")
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const districtsRes = await fetch(
    `${process.env.NODECOMMERCE_BASE_URL}/api/districts?active=true`,
    { headers: { Authorization: `Bearer ${process.env.NODECOMMERCE_INTERNAL_KEY}` } }
  )
  const districts = await districtsRes.json()

  const results = []

  for (const district of districts) {
    const res = await fetch(
      `${process.env.NODECOMMERCE_BASE_URL}/api/agent/forecast/run`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CRON-SECRET": process.env.CRON_SECRET!
        },
        body: JSON.stringify({
          districtId: district.id,
          triggerReason: "scheduled_cron"
        })
      }
    )
    const result = await res.json()
    results.push({ districtId: district.id, ...result })
  }

  return NextResponse.json({
    success: true,
    districtsProcessed: results.length,
    results
  })
}
