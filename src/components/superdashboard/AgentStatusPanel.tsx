"use client";
import React, { useEffect, useState } from "react";

interface UiPathJob {
  id: string;
  jobId: string;
  status: string;
  shipmentId: string;
  createdAt: string;
}

const AGENTS = [
  { name: "REZA",    nameBn: "রেজা",    icon: "🚛", role: "Logistics Router",       roleBn: "লজিস্টিক্স রাউটার" },
  { name: "PROVA",   nameBn: "প্রোভা",  icon: "🧠", role: "Demand Intelligence",    roleBn: "চাহিদা বিশ্লেষক" },
  { name: "TRACE",   nameBn: "ট্রেস",   icon: "🔍", role: "Anomaly Detector",       roleBn: "অনিয়ম সনাক্তকারী" },
  { name: "JUDGE",   nameBn: "জাজ",    icon: "⚖️", role: "Contract Evaluator",     roleBn: "চুক্তি মূল্যায়নকারী" },
  { name: "REORDER", nameBn: "রিঅর্ডার", icon: "📦", role: "Restock Initiator",      roleBn: "রিস্টক সূচনাকারী" },
];

function statusLabel(s: string) {
  if (s === "Running")    return { color: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-500/30", dot: "bg-yellow-400" };
  if (s === "Dispatched") return { color: "text-blue-400",   bg: "bg-blue-900/20 border-blue-500/30",     dot: "bg-blue-400" };
  if (s === "Delivered")  return { color: "text-emerald-400",bg: "bg-emerald-900/20 border-emerald-500/30",dot: "bg-emerald-400" };
  if (s === "Failed")     return { color: "text-red-400",    bg: "bg-red-900/20 border-red-500/30",       dot: "bg-red-400" };
  return { color: "text-slate-400", bg: "bg-slate-800/40 border-slate-700/40", dot: "bg-slate-500" };
}

export default function AgentStatusPanel() {
  const [jobs, setJobs] = useState<UiPathJob[]>([]);
  const [lastFetch, setLastFetch] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/uipath/jobs");
        if (!res.ok) return;
        const data = await res.json();
        setJobs(data.jobs ?? []);
        setLastFetch(new Date().toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }));
      } catch {
        // Silent fail — non-critical panel
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const runningCount  = jobs.filter(j => j.status === "Running").length;
  const doneCount     = jobs.filter(j => j.status === "Delivered").length;
  const failedCount   = jobs.filter(j => j.status === "Failed").length;

  // Derive live agent statuses from job data
  const getAgentStatus = (agentName: string): "active" | "idle" | "error" => {
    if (agentName === "REZA")    return runningCount > 0 ? "active" : "idle";
    if (agentName === "PROVA")   return jobs.length > 0 ? "active" : "idle";
    if (agentName === "TRACE")   return failedCount > 0 ? "error" : "idle";
    if (agentName === "JUDGE")   return doneCount > 0 ? "active" : "idle";
    if (agentName === "REORDER") return failedCount > 0 ? "error" : runningCount > 0 ? "active" : "idle";
    return "idle";
  };

  const getAgentStat = (agentName: string): string => {
    if (agentName === "REZA")    return `${runningCount} মুলতবি রুট`;
    if (agentName === "PROVA")   return `${jobs.length} পূর্বাভাস`;
    if (agentName === "TRACE")   return `${failedCount} সতর্কতা`;
    if (agentName === "JUDGE")   return `${doneCount} সম্পন্ন`;
    if (agentName === "REORDER") return `${runningCount} চলছে`;
    return "—";
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span>🤖</span>
          <div>
            <div className="font-bold text-sm text-slate-100">এজেন্ট ফ্লিট</div>
            <div className="text-[10px] text-slate-500">Agent Fleet Status</div>
          </div>
        </div>
        {lastFetch && (
          <div className="text-[10px] text-slate-600">
            আপডেট {lastFetch}
          </div>
        )}
      </div>

      {/* Live UiPath Job Summary */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "চলছে", value: runningCount,  color: "text-yellow-400" },
            { label: "সম্পন্ন", value: doneCount,   color: "text-emerald-400" },
            { label: "ব্যর্থ", value: failedCount, color: "text-red-400" },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/50 rounded-xl p-2 text-center border border-slate-700/50">
              <div className={`font-bold text-base ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Agent Cards */}
      <div className="flex flex-col gap-2">
        {AGENTS.map((agent) => {
          const st = getAgentStatus(agent.name);
          const style = st === "active" ? statusLabel("Running") : st === "error" ? statusLabel("Failed") : statusLabel("idle");
          return (
            <div
              key={agent.name}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${style.bg}`}
            >
              <span className="text-base shrink-0">{agent.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[11px] text-slate-200">{agent.nameBn}</span>
                  <span className="text-[9px] text-slate-600">/ {agent.name}</span>
                </div>
                <div className="text-[9px] text-slate-500 truncate">{agent.roleBn}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className={`text-[10px] font-mono ${style.color}`}>{getAgentStat(agent.name)}</div>
                <div className={`w-2 h-2 rounded-full ${style.dot} ${st === "active" ? "animate-pulse" : ""}`} />
              </div>
            </div>
          );
        })}
      </div>

      {jobs.length === 0 && (
        <div className="text-[10px] text-slate-600 italic text-center py-1">
          ACO চালালে লাইভ ডেটা দেখা যাবে
        </div>
      )}
    </div>
  );
}
