"use client"
import React, { useState, useEffect } from "react"
import { AgentStatusCard } from "@/components/ui/AgentStatusCard"

export default function AgentStatusPanel() {
  const [lastRun] = useState(new Date().toLocaleTimeString())

  // Mocking status since there isn't a dedicated endpoint for these yet
  return (
    <div className="absolute top-80 right-80 z-40 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-xl w-72 flex flex-col gap-3">
      <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-1">
        <span>🤖</span> Agent Fleet Status
      </h3>
      <AgentStatusCard
        agentName="REZA"
        agentNameBn="রেজা"
        lastRun={lastRun}
        status="active"
        statsLabel="Logistics Routes Optimized"
        statsValue="142"
      />
      <AgentStatusCard
        agentName="PROVA"
        agentNameBn="প্রোভা"
        lastRun={lastRun}
        status="idle"
        statsLabel="Demands Predicted"
        statsValue="89"
      />
      <AgentStatusCard
        agentName="TRACE"
        agentNameBn="ট্রেস"
        lastRun={lastRun}
        status="active"
        statsLabel="Anomalies Detected"
        statsValue="12"
      />
      <AgentStatusCard
        agentName="JUDGE"
        agentNameBn="জাজ"
        lastRun={lastRun}
        status="idle"
        statsLabel="Contracts Evaluated"
        statsValue="45"
      />
      <AgentStatusCard
        agentName="REORDER"
        agentNameBn="রিঅর্ডার"
        lastRun={lastRun}
        status="error"
        statsLabel="Restocks Initiated"
        statsValue="3"
      />
    </div>
  )
}
