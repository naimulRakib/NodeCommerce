"use client";

import React, { useMemo } from "react";
import { CircleMarker, Polyline, Popup } from "react-leaflet";

interface DemandPheromone {
  id: string;
  entityType: string;
  entityName: string;
  productName: string;
  score: number;
  demandDeficit: number;
  lat: number;
  lng: number;
  updatedAt?: string;
}

interface RoutePheromone {
  id: string;
  fromEntity: string;
  toEntity: string;
  productName: string;
  score: number;
  successCount: number;
  totalRouted: number;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}

interface PheromoneLayerProps {
  pheromoneData: {
    demandPheromones: DemandPheromone[];
    routePheromones: RoutePheromone[];
  } | null;
  isVisible: boolean;
}

function PheromoneLayer({ pheromoneData, isVisible }: PheromoneLayerProps) {
  const renderedCircles = useMemo(() => {
    const demandPheromones = pheromoneData?.demandPheromones || [];
    return demandPheromones.map((p) => {
      let color = "#22C55E"; // low green
      if (p.score >= 8.0) color = "#DC2626"; // critical red
      else if (p.score >= 5.0) color = "#EA580C"; // high orange
      else if (p.score >= 2.0) color = "#EAB308"; // medium yellow

      const radius = Math.min(30, Math.max(8, p.score * 3));

      return (
        <CircleMarker
          key={`demand-${p.id}`}
          center={[p.lat, p.lng]}
          pathOptions={{
            color: color,
            fillColor: color,
            fillOpacity: 0.4,
            weight: 2,
          }}
          radius={radius}
        >
          <Popup>
            <div className="text-sm font-sans">
              <strong className="block text-base">{p.entityName}</strong>
              <div className="mt-1">
                Score: <span className="font-mono">{p.score.toFixed(2)}</span>
                {p.updatedAt && <span className="text-xs text-slate-500 ml-1">(last updated: {new Date(p.updatedAt).toLocaleTimeString()})</span>}
              </div>
              <div>
                Current deficit: {p.demandDeficit} units
                {p.demandDeficit === 0 && <span className="text-emerald-600 ml-1 font-bold">(demand fulfilled)</span>}
              </div>
              <div>Product: {p.productName}</div>
            </div>
          </Popup>
        </CircleMarker>
      );
    });
  }, [pheromoneData?.demandPheromones]);

  const renderedLines = useMemo(() => {
    const routePheromones = pheromoneData?.routePheromones || [];
    return routePheromones
      .filter((r) => r.successCount > 0)
      .map((r) => {
        // Interpolate color from green (score=1) to red (score=10)
        // Simplified mapping for visual distinction
        let color = "#22C55E";
        if (r.score >= 5.0) color = "#DC2626";
        else if (r.score >= 2.0) color = "#EAB308";

        const weight = Math.min(6, Math.max(1, r.successCount / 2));

        return (
          <Polyline
            key={`route-${r.id}`}
            positions={[
              [r.fromLat, r.fromLng],
              [r.toLat, r.toLng],
            ]}
            pathOptions={{
              color: color,
              weight: weight,
              opacity: 0.6,
              dashArray: "5, 5",
            }}
          >
            <Popup>
              <div className="text-sm font-sans">
                <strong className="block text-base">{r.fromEntity} &rarr; {r.toEntity}</strong>
                <div className="mt-1">Route Score: <span className="font-mono">{r.score.toFixed(2)}</span></div>
                <div>Times Used: {r.successCount}</div>
                <div>Total Routed: {r.totalRouted} units</div>
              </div>
            </Popup>
          </Polyline>
        );
      });
  }, [pheromoneData?.routePheromones]);

  if (!isVisible || !pheromoneData) return null;

  return (
    <>
      {renderedLines}
      {renderedCircles}
    </>
  );
}

export default PheromoneLayer;
