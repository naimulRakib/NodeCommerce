"use client";

import { useState } from "react";

export default function UpazillaGrokPanel() {
  const [messages, setMessages] = useState<{ role: "assistant" | "user"; content: string; metrics?: any }[]>([
    {
      role: "assistant",
      content: "হ্যালো! আমি Grok AI অ্যাসিস্ট্যান্ট। আপনার উপজেলা হাবের বর্তমান স্টক, লোকাল রিসেলারদের চাহিদা বিশ্লেষণ করে আমি আপনাকে এআই-ভিত্তিক স্টক ম্যানেজমেন্টের পরামর্শ দিতে পারি।",
    },
  ]);
  const [loading, setLoading] = useState(false);

  const fetchPrediction = async () => {
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: "আমার বর্তমান স্টক ও লোকাল রিসেলারদের চাহিদা বিশ্লেষণ করে একটি রিপোর্ট দিন।" }]);

    try {
      const res = await fetch("/api/upazilla-reseller/ai-predict", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to fetch prediction");

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.analysis,
          metrics: data.metrics,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "দুঃখিত, বিশ্লেষণ করতে সমস্যা হয়েছে: " + err.message },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px] mt-6">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-slate-900 rounded-t-xl text-white">
        <span className="text-2xl">🤖</span>
        <div>
          <h2 className="font-bold">Grok AI হাব ম্যানেজার</h2>
          <p className="text-xs text-slate-400">Powered by xAI</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[85%] p-4 rounded-2xl ${
                msg.role === "assistant"
                  ? "bg-white border border-gray-200 shadow-sm text-gray-800"
                  : "bg-blue-600 text-white"
              }`}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>

              {msg.metrics && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {msg.metrics.map((m: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{m.label}</div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1">
                        {m.trend === "up" ? <span className="text-emerald-500">↑</span> : <span className="text-rose-500">↓</span>}
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 p-4 rounded-2xl flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-150"></div>
              <span className="text-xs text-gray-500 ml-2">Grok ডাটা বিশ্লেষণ করছে...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 bg-white rounded-b-xl">
        <button
          onClick={fetchPrediction}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <span className="text-lg">✨</span>
          <span>হাব অ্যানালাইসিস জেনারেট করুন</span>
        </button>
      </div>
    </div>
  );
}
