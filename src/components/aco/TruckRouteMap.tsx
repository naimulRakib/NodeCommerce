"use client";

import React, { useEffect, useState, useRef } from "react";
import L from "leaflet";
import { Polyline, CircleMarker, Marker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface TruckRouteMapProps {
  trucks: any[];
}

const TRUCK_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // orange
  "#8b5cf6", // purple
  "#ef4444", // red
  "#ec4899", // pink
  "#14b8a6", // teal
];

// Create a custom DivIcon for the truck
const getTruckIcon = (color: string) => {
  return L.divIcon({
    className: "custom-truck-icon",
    html: `<div style="font-size: 20px; line-height: 1; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); display: flex; align-items: center; justify-content: center; background: white; border: 2px solid ${color}; border-radius: 50%; width: 32px; height: 32px;">🚚</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

export default function TruckRouteMap({ trucks }: TruckRouteMapProps) {
  const [animatedTrucks, setAnimatedTrucks] = useState<any[]>(trucks);
  const isMounted = useRef(true);

  // We could poll /api/aco/trucks?jobId=latest here, but we'll accept it via props 
  // and just use an interval to simulate smooth polling update if we had a dedicated endpoint.
  // Since we rely on props, the parent SuperDashboard should pass down updated trucks.
  useEffect(() => {
    setAnimatedTrucks(trucks);
  }, [trucks]);

  if (!animatedTrucks || animatedTrucks.length === 0) return null;

  return (
    <>
      {animatedTrucks.map((truck, tIdx) => {
        if (!truck.stops || truck.stops.length === 0) return null;
        
        const color = TRUCK_COLORS[tIdx % TRUCK_COLORS.length];
        
        // Extract coordinates for Polyline
        const positions: [number, number][] = truck.stops.map((s: any) => [s.lat, s.lng]);

        // Find current position for the truck marker
        let currentPos: [number, number] = positions[0];
        if (truck.status === "completed") {
          currentPos = positions[positions.length - 1];
        } else if (truck.currentStopIndex > 0 && truck.currentStopIndex < positions.length) {
          // It's at a stop or heading to it. We just snap it to the currentStopIndex
          currentPos = positions[truck.currentStopIndex];
        }

        return (
          <React.Fragment key={truck.id}>
            {/* The Route Path */}
            <Polyline 
              positions={positions} 
              pathOptions={{ color, weight: 4, opacity: 0.7, dashArray: "10, 10" }} 
            />

            {/* The Stops */}
            {truck.stops.map((stop: any, sIdx: number) => {
              const isPast = sIdx < truck.currentStopIndex;
              
              // Node shapes: Pickup = square-ish, Delivery = circle
              return (
                <CircleMarker
                  key={stop.id}
                  center={[stop.lat, stop.lng]}
                  radius={8}
                  pathOptions={{
                    color,
                    fillColor: isPast ? color : "white",
                    fillOpacity: 1,
                    weight: 3,
                  }}
                >
                  <Popup className="rounded-xl overflow-hidden font-sans">
                    <div className="p-1">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                        {stop.stopType.replace("_", " ")}
                      </div>
                      <h3 className="font-bold text-gray-900 text-base mb-2">{stop.entityName}</h3>
                      <div className="bg-gray-50 p-2 rounded-lg text-sm border border-gray-100">
                        {stop.items.map((i: any) => (
                          <div key={i.id} className="flex justify-between border-b border-gray-200 last:border-0 py-1">
                            <span>{i.productName}</span>
                            <span className="font-bold">{i.plannedQty}</span>
                          </div>
                        ))}
                      </div>
                      <div className={`mt-2 text-xs font-bold ${isPast ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {isPast ? '✓ Completed' : 'Pending'}
                      </div>
                    </div>
                  </Popup>
                  <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                    <span className="font-semibold text-xs">{stop.entityName}</span>
                  </Tooltip>
                </CircleMarker>
              );
            })}

            {/* The Animated Truck Marker */}
            <Marker 
              position={currentPos} 
              icon={getTruckIcon(color)}
              zIndexOffset={1000}
            >
              <Popup>
                <div className="font-bold text-center">
                  Truck {truck.truckCode}<br/>
                  <span className="text-xs font-normal text-gray-500">
                    Status: {truck.status}
                  </span>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}

      {/* Legend inside map view, using standard HTML overlay technique */}
      <div className="absolute bottom-6 left-6 z-[1000] bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-200">
        <h4 className="font-bold text-sm mb-2 text-gray-800 uppercase tracking-wider">Active Routes</h4>
        <div className="space-y-2">
          {animatedTrucks.map((truck, idx) => (
            <div key={truck.id} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: TRUCK_COLORS[idx % TRUCK_COLORS.length] }}></div>
              <span className="text-sm font-semibold text-gray-700">Truck {truck.truckCode}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
