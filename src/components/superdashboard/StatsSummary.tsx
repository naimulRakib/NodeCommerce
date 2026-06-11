import React from "react";
import { MetricCard } from "@/components/ui/MetricCard";
interface StatsSummaryProps {
  summary: {
    totalSellers: number;
    totalLocalResellers: number;
    totalUpazillaResellers: number;
    totalDistrictResellers: number;
    totalNodes: number;
  };
}

export default function StatsSummary({ summary }: StatsSummaryProps) {
  const {
    totalSellers = 0,
    totalLocalResellers = 0,
    totalUpazillaResellers = 0,
    totalDistrictResellers = 0,
    totalNodes = 0,
  } = summary;

  return (
    // Force dark theme context so MetricCard CSS vars resolve to dark palette
    <div data-theme="dark" className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
        <span className="text-base">📊</span>
        <div>
          <div className="font-bold text-sm text-slate-100">নেটওয়ার্ক পরিসংখ্যান</div>
          <div className="text-[10px] text-slate-500">Network Statistics</div>
        </div>
      </div>

      {/* 2x2 Grid for Reseller Types */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          labelBn="জেলা"
          labelEn="Districts"
          value={totalDistrictResellers}
          subtextBn="জেলা রিসেলার"
          subtextEn="District Resellers"
          icon={<span className="text-xl">🏛️</span>}
          accentColor="var(--nc-primary)"
        />
        
        <MetricCard
          labelBn="উপজেলা"
          labelEn="Upazillas"
          value={totalUpazillaResellers}
          subtextBn="উপজেলা রিসেলার"
          subtextEn="Upazilla Resellers"
          icon={<span className="text-xl">🏘️</span>}
          accentColor="var(--nc-info)"
        />
        
        <MetricCard
          labelBn="লোকাল"
          labelEn="Locals"
          value={totalLocalResellers}
          subtextBn="লোকাল রিসেলার"
          subtextEn="Local Resellers"
          icon={<span className="text-xl">🏪</span>}
          accentColor="var(--nc-success)"
        />
        
        <MetricCard
          labelBn="বিক্রেতা"
          labelEn="Sellers"
          value={totalSellers}
          subtextBn="মোট বিক্রেতা"
          subtextEn="Total Sellers"
          icon={<span className="text-xl">🛍️</span>}
          accentColor="var(--nc-warning)"
        />
      </div>

      <MetricCard
        labelBn="সাপ্লাই চেইন ম্যাপ"
        labelEn="Supply Chain Map Summary"
        value={totalNodes}
        subtextBn="মোট সক্রিয় নোড"
        subtextEn="Total Active Nodes"
        icon={<span className="text-2xl animate-pulse">🇧🇩</span>}
        accentColor="var(--nc-gold)"
      />
    </div>
  );
}
