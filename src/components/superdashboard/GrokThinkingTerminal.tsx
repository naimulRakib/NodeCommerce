"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

type Status = "idle" | "thinking" | "complete" | "error";

interface ThoughtLine {
  id: number;
  text: string;
  ts: string;
}

interface Props {
  /** Set to true to start the stream */
  active: boolean;
  /** Called when the stream finishes */
  onComplete?: () => void;
  /** Called when the user clicks X to close */
  onClose?: () => void;
}

export default function GrokThinkingTerminal({ active, onComplete, onClose }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [thoughts, setThoughts] = useState<ThoughtLine[]>([]);
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const now = () =>
    new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const addThought = useCallback((text: string) => {
    counterRef.current += 1;
    setThoughts((prev) => [
      ...prev,
      { id: counterRef.current, text, ts: now() },
    ]);
  }, []);

  const startStream = useCallback(async () => {
    // Abort any running stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setThoughts([]);
    counterRef.current = 0;
    setStatus("thinking");

    try {
      const res = await fetch("/api/agent/grok-think", {
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`API returned ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") {
            setStatus("complete");
            onComplete?.();
            return;
          }
          try {
            const parsed = JSON.parse(raw);
            if (parsed.text) addThought(parsed.text);
          } catch {
            // ignore malformed lines
          }
        }
      }

      setStatus("complete");
      onComplete?.();
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("[GrokTerminal] Stream error:", err);
      addThought(`❌ Stream error: ${err.message}`);
      setStatus("error");
    }
  }, [addThought, onComplete]);

  // Auto-start whenever `active` flips to true
  useEffect(() => {
    if (active) {
      startStream();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [active, startStream]);

  // Auto-scroll to bottom on new thoughts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts]);

  // Don't render until triggered
  if (!active && thoughts.length === 0) return null;

  const statusColor =
    status === "thinking" ? "text-yellow-400" :
    status === "complete" ? "text-emerald-400" :
    status === "error"    ? "text-red-400" :
    "text-slate-400";

  const statusLabel =
    status === "thinking" ? "LIVE" :
    status === "complete" ? "DONE" :
    status === "error"    ? "ERR" :
    "IDLE";

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-[9999]
        w-[420px] max-w-[calc(100vw-2rem)]
        bg-slate-950/95 border border-slate-700/80
        rounded-2xl shadow-2xl shadow-black/60
        backdrop-blur-xl
        transition-all duration-300 ease-in-out
        font-mono text-xs
        ${minimized ? "h-11 overflow-hidden" : ""}
      `}
      style={{ boxShadow: "0 0 40px 0 rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.15)" }}
    >
      {/* ── Title bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          {/* Traffic lights */}
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        </div>

        <div className="flex items-center gap-2 text-slate-300 text-[11px] font-semibold tracking-wider">
          <span className="text-indigo-400">🧠</span>
          <span>GROK AI — PROVA Agent</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <span className={`flex items-center gap-1 ${statusColor} font-bold text-[10px] tracking-widest`}>
            {status === "thinking" && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400" />
              </span>
            )}
            {statusLabel}
          </span>

          {/* Minimize */}
          <button
            onClick={() => setMinimized((m) => !m)}
            className="text-slate-500 hover:text-slate-200 transition-colors px-1 cursor-pointer"
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? "▲" : "▼"}
          </button>

          {/* Close */}
          <button
            onClick={() => { abortRef.current?.abort(); onClose?.(); }}
            className="text-slate-500 hover:text-red-400 transition-colors px-1 cursor-pointer"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Thought stream ── */}
      {!minimized && (
        <div
          ref={scrollRef}
          className="h-72 overflow-y-auto px-4 py-3 flex flex-col gap-1 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700"
        >
          {thoughts.length === 0 && status === "thinking" && (
            <span className="text-slate-500 animate-pulse">Connecting to PROVA agent...</span>
          )}

          {thoughts.map((t) => (
            <div key={t.id} className="flex gap-2 items-start leading-relaxed">
              <span className="text-slate-600 shrink-0 select-none">{t.ts}</span>
              <span
                className={`
                  ${t.text.startsWith("⚡") ? "text-yellow-300 font-semibold" : ""}
                  ${t.text.startsWith("✅") ? "text-emerald-400" : ""}
                  ${t.text.startsWith("❌") ? "text-red-400" : ""}
                  ${t.text.startsWith("🔍") || t.text.startsWith("🧠") || t.text.startsWith("📊") ? "text-indigo-300" : ""}
                  ${!t.text.match(/^[⚡✅❌🔍🧠📊]/) ? "text-slate-300" : ""}
                `}
              >
                {t.text}
              </span>
            </div>
          ))}

          {/* Blinking cursor when thinking */}
          {status === "thinking" && (
            <span className="text-indigo-400 animate-pulse select-none">▋</span>
          )}

          {/* Footer when done */}
          {status === "complete" && (
            <div className="mt-2 pt-2 border-t border-slate-800 text-emerald-500 font-semibold">
              ─── PROVA analysis complete ───
            </div>
          )}
        </div>
      )}

      {/* ── Bottom bar ── */}
      {!minimized && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800/60 text-[10px] text-slate-600">
          <span>NodeCommerce · PROVA v2.1 · Groq LLaMA-3</span>
          {status !== "thinking" && (
            <button
              onClick={startStream}
              className="text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors font-semibold"
            >
              ↺ Re-run
            </button>
          )}
        </div>
      )}
    </div>
  );
}
