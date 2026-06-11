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
    <div className="flex flex-col gap-4">
      {/* 2x2 Grid for Reseller Types */}
      <div className="grid grid-cols-2 gap-4">
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
