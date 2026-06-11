"use client";

import React, { useEffect, useState, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Popup,
  CircleMarker,
  LayerGroup,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import PheromoneLayer from "./PheromoneLayer";
import dynamic from "next/dynamic";
import type { TruckRoute } from "./ACOTruckLayer";

const TruckRouteMap = dynamic(() => import("../aco/TruckRouteMap"), { ssr: false });
const ACOTruckLayer = dynamic(() => import("./ACOTruckLayer"), { ssr: false });


// @ts-ignore
import DISTRICT_CENTROIDS_RAW from "@/data/district-centroids.js";

const DISTRICT_CENTROIDS = DISTRICT_CENTROIDS_RAW as Record<string, { lat: number; lng: number }>;

const normalizedDistrictCentroids: Record<string, { lat: number; lng: number }> = {};
Object.entries(DISTRICT_CENTROIDS).forEach(([key, val]) => {
  normalizedDistrictCentroids[key.toLowerCase().trim()] = val;
});

interface NodeItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city?: string;
  upazilla?: string;
  district?: string;
  type: "seller" | "local_reseller" | "upazilla_reseller" | "district_reseller";
  createdAt?: string | Date;
}

interface MapClientProps {
  nodes: {
    sellers: NodeItem[];
    localResellers: NodeItem[];
    upazillaResellers: NodeItem[];
    districtResellers: NodeItem[];
  };
  visibleLayers: {
    seller: boolean;
    local_reseller: boolean;
    upazilla_reseller: boolean;
    district_reseller: boolean;
    trucks?: boolean;
  };
  filterDistrict: string;
  onNodeClick: (node: NodeItem) => void;
  pheromoneData?: any;
  showPheromoneLayer?: boolean;
  truckData?: any[];
  /** Live ACO truck animation routes */
  acoRoutes?: TruckRoute[];
  onTruckArrived?: (route: TruckRoute) => void;
}


// Custom MarkerCluster icons removed for React 19 compatibility


// Map Zoom Listener Component
function MapZoomListener({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  const map = useMapEvents({
    zoomend() {
      onZoomChange(map.getZoom());
    },
  });
  return null;
}

// Zoom to District flyTo handler
function ZoomToDistrict({ district }: { district: string }) {
  const map = useMap();

  useEffect(() => {
    if (!district) return;
    const lookupKey = district.toLowerCase().trim();
    const coords = normalizedDistrictCentroids[lookupKey];
    if (coords) {
      map.flyTo([coords.lat, coords.lng], 10, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [district, map]);

  return null;
}

function MapClientComponent({
  nodes,
  visibleLayers,
  filterDistrict,
  onNodeClick,
  pheromoneData,
  showPheromoneLayer,
  truckData,
  acoRoutes,
  onTruckArrived,
}: MapClientProps) {
  const [zoom, setZoom] = useState(7);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);

  // Fix default Leaflet icon assets resolution in Next.js
  useEffect(() => {
    if (typeof window !== "undefined") {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "/leaflet/marker-icon-2x.png",
        iconUrl: "/leaflet/marker-icon.png",
        shadowUrl: "/leaflet/marker-shadow.png",
      });
    }
  }, []);

  // Center coordinate of Bangladesh
  const centerPosition: [number, number] = [23.685, 90.3563];

  // 1. Memoize District Resellers (purple, radius 18, render first/underneath)
  const districtResellerMarkers = useMemo(() => {
    if (!visibleLayers.district_reseller) return null;
    return (
      <LayerGroup>
        {(nodes.districtResellers || []).filter(n => n?.lat != null && n?.lng != null).slice(0, 500).map((node) => (
          <CircleMarker
            key={node.id}
            center={[node.lat, node.lng]}
            radius={18}
            pathOptions={{
              fillColor: "#7C3AED",
              color: "#5B21B6",
              fillOpacity: 0.85,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onNodeClick(node),
            }}
          >
            <Popup>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontFamily: "sans-serif", fontSize: "12px", maxWidth: "200px" }}>
                <strong className="line-clamp-1 truncate" title={node.name || "N/A"}>{node.name || "N/A"}</strong>
                <span>Type: District Reseller</span>
                <span>Location: {node.district || "N/A"}</span>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </LayerGroup>
    );
  }, [nodes.districtResellers, visibleLayers.district_reseller, onNodeClick]);

  // 2. Memoize Upazilla Resellers (blue, radius 12)
  const upazillaResellerMarkers = useMemo(() => {
    if (!visibleLayers.upazilla_reseller) return null;
    return (
      <LayerGroup>
        {(nodes.upazillaResellers || []).filter(n => n?.lat != null && n?.lng != null).slice(0, 500).map((node) => (
          <CircleMarker
            key={node.id}
            center={[node.lat, node.lng]}
            radius={12}
            pathOptions={{
              fillColor: "#2563EB",
              color: "#1D4ED8",
              fillOpacity: 0.85,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onNodeClick(node),
            }}
          >
            <Popup>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontFamily: "sans-serif", fontSize: "12px", maxWidth: "200px" }}>
                <strong className="line-clamp-1 truncate" title={node.name || "N/A"}>{node.name || "N/A"}</strong>
                <span>Type: Upazilla Reseller</span>
                <span>Location: {node.upazilla || "N/A"}</span>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </LayerGroup>
    );
  }, [nodes.upazillaResellers, visibleLayers.upazilla_reseller, onNodeClick]);

  // 3. Memoize Local Resellers (green, radius 8, CLUSTERED)
  const localResellerMarkers = useMemo(() => {
    if (!visibleLayers.local_reseller) return null;
    return (
      <LayerGroup>
        {(nodes.localResellers || []).filter(n => n?.lat != null && n?.lng != null).slice(0, 500).map((node) => (
          <CircleMarker
            key={node.id}
            center={[node.lat, node.lng]}
            radius={8}
            pathOptions={{
              fillColor: "#059669",
              color: "#047857",
              fillOpacity: 0.85,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onNodeClick(node),
            }}
          >
            <Popup>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontFamily: "sans-serif", fontSize: "12px", maxWidth: "200px" }}>
                <strong className="line-clamp-1 truncate" title={node.name || "N/A"}>{node.name || "N/A"}</strong>
                <span>Type: Local Reseller</span>
                <span>Location: {node.upazilla || "N/A"}</span>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </LayerGroup>
    );
  }, [nodes.localResellers, visibleLayers.local_reseller, onNodeClick]);

  // 4. Memoize Sellers (amber, radius 6, CLUSTERED)
  const sellerMarkers = useMemo(() => {
    if (!visibleLayers.seller) return null;
    return (
      <LayerGroup>
        {(nodes.sellers || []).filter(n => n?.lat != null && n?.lng != null).slice(0, 500).map((node) => (
          <CircleMarker
            key={node.id}
            center={[node.lat, node.lng]}
            radius={6}
            pathOptions={{
              fillColor: "#D97706",
              color: "#B45309",
              fillOpacity: 0.85,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onNodeClick(node),
            }}
          >
            <Popup>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontFamily: "sans-serif", fontSize: "12px", maxWidth: "200px" }}>
                <strong className="line-clamp-1 truncate" title={node.name || "N/A"}>{node.name || "N/A"}</strong>
                <span>Type: Seller</span>
                <span>Location: {node.upazilla || "N/A"}</span>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </LayerGroup>
    );
  }, [nodes.sellers, visibleLayers.seller, onNodeClick]);

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={centerPosition}
        zoom={7}
        minZoom={6}
        maxZoom={16}
        zoomControl={false}
        preferCanvas={true}
        className="w-full h-full z-0"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Listeners & Behaviors */}
        <MapZoomListener onZoomChange={setZoom} />
        <ZoomToDistrict district={filterDistrict} />

        {/* Render markers in layers (District Resellers are first, rendering underneath, Sellers last on top) */}
        {districtResellerMarkers}
        {upazillaResellerMarkers}
        {localResellerMarkers}
        {sellerMarkers}

        <PheromoneLayer 
          pheromoneData={pheromoneData}
          isVisible={showPheromoneLayer || false}
        />

        {visibleLayers.trucks && truckData && truckData.length > 0 && (
          <TruckRouteMap trucks={truckData} />
        )}

        {/* Live ACO truck animation layer */}
        {acoRoutes && acoRoutes.length > 0 && (
          <ACOTruckLayer
            routes={acoRoutes}
            onTruckArrived={onTruckArrived}
            travelMs={4000}
          />
        )}

        <ZoomControl position="bottomright" />
      </MapContainer>

      {/* ========================================== */}
      {/* FLOATING OVERLAYS                         */}
      {/* ========================================== */}

      {/* Bottom-left Overlays (Legends) */}
      <div className="absolute bottom-5 left-5 z-[1000] flex flex-col gap-2 max-w-[240px] pointer-events-auto">
        {/* Heatmap density legend (zoom <= 8) */}
        {zoom <= 8 && (
          <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-800 rounded-xl p-2.5 shadow-lg flex items-center gap-3 text-[10px] font-bold text-slate-300 select-none animate-fade-in">
            <span className="flex items-center gap-1">
              <span className="text-orange-500">●</span> High density
            </span>
            <span className="flex items-center gap-1">
              <span className="text-emerald-500">●</span> Medium
            </span>
            <span className="flex items-center gap-1">
              <span className="text-blue-500">●</span> Low
            </span>
          </div>
        )}

        {/* Collapsible Map Legend */}
        <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-800 rounded-xl p-3 shadow-lg text-slate-100 flex flex-col gap-2 transition-all duration-300">
          <div
            className="flex items-center justify-between gap-4 cursor-pointer select-none"
            onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}
          >
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
              Legend
            </span>
            <span className="text-xs text-slate-400">
              {isLegendCollapsed ? "＋" : "－"}
            </span>
          </div>

          {!isLegendCollapsed && (
            <div className="flex flex-col gap-2 text-xs font-medium mt-1">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-purple-500 border border-purple-650 flex-shrink-0" />
                <span className="text-[11px] text-slate-300">District Reseller (18px)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-blue-650 flex-shrink-0" />
                <span className="text-[11px] text-slate-300">Upazilla Reseller (12px)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 border border-emerald-650 flex-shrink-0" />
                <span className="text-[11px] text-slate-300">Local Reseller (8px)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 border border-amber-650 flex-shrink-0" />
                <span className="text-[11px] text-slate-300">Seller (6px)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top-right Node Count Overlay */}
      <div className="absolute top-5 right-5 z-[1000] max-w-[280px] pointer-events-auto">
        <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-800 rounded-xl p-3 shadow-lg text-slate-200 text-xs font-semibold flex flex-col gap-1">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
            Live Node Filters
          </div>
          <div className="text-[11px] text-slate-350 leading-relaxed mt-0.5">
            Showing:{" "}
            <span className="text-amber-400 font-bold">{nodes.sellers.length} sellers</span>,{" "}
            <span className="text-emerald-400 font-bold">{nodes.localResellers.length} local</span>,{" "}
            <span className="text-blue-400 font-bold">{nodes.upazillaResellers.length} upazilla</span>,{" "}
            <span className="text-purple-400 font-bold">{nodes.districtResellers.length} district</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Performance Wrap
export const MapClient = React.memo(MapClientComponent);
export default MapClient;
