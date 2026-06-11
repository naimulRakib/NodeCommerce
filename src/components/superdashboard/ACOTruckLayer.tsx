"use client";

/**
 * ACOTruckLayer
 * =============
 * Renders animated truck routes on the Leaflet map during/after an ACO run.
 *
 * For each shipment route:
 *  1. Draws a dashed animated Polyline (phase-colored)
 *  2. Animates a 🚛 DivIcon marker along the polyline over 4 seconds
 *  3. Fires onTruckArrived(shipment) when the truck reaches destination
 *
 * Phases run SEQUENTIALLY: Phase 1 trucks animate, all arrive, then Phase 2 starts.
 *
 * Phase colors:
 *   Phase 1 (Seller → Upazilla): amber   #F59E0B
 *   Phase 2 (Upazilla → District): blue   #3B82F6
 *   Phase 3 (inter-district): purple      #8B5CF6
 *   Phase 4 (dist hub → upazilla): teal   #14B8A6
 */

import React, { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export interface TruckRoute {
  id: string;
  phase: number;
  fromLat: number;
  fromLng: number;
  fromName: string;
  toLat: number;
  toLng: number;
  toName: string;
  totalQuantity: number;
  products?: { name: string; qty?: number; quantity?: number }[];
}

interface Props {
  routes: TruckRoute[];
  /** Called when a truck finishes its animation */
  onTruckArrived?: (route: TruckRoute) => void;
  /** Travel time per leg in ms */
  travelMs?: number;
}

const PHASE_COLORS: Record<number, string> = {
  1: "#F59E0B",  // amber
  2: "#3B82F6",  // blue
  3: "#8B5CF6",  // purple
  4: "#14B8A6",  // teal
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function ACOTruckLayer({ routes, onTruckArrived, travelMs = 4000 }: Props) {
  const map = useMap();
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!map || routes.length === 0) return;

    // Clean up any previous layers
    cleanupRef.current.forEach(fn => fn());
    cleanupRef.current = [];

    // Group by phase
    const byPhase: Record<number, TruckRoute[]> = {};
    for (const r of routes) {
      if (!byPhase[r.phase]) byPhase[r.phase] = [];
      byPhase[r.phase].push(r);
    }

    const phases = Object.keys(byPhase).map(Number).sort();

    let phaseDelay = 0;

    for (const phase of phases) {
      const phaseRoutes = byPhase[phase];
      const color = PHASE_COLORS[phase] ?? "#6B7280";

      const phaseTimeoutIds: ReturnType<typeof setTimeout>[] = [];

      for (const route of phaseRoutes) {
        const from: L.LatLngExpression = [route.fromLat, route.fromLng];
        const to: L.LatLngExpression = [route.toLat, route.toLng];

        // Snap map to show the route
        const startMs = phaseDelay;

        const t1 = setTimeout(() => {
          // 1. Draw the route polyline (dashed, animated via CSS)
          const polyline = L.polyline([from, to], {
            color,
            weight: 3,
            opacity: 0.85,
            dashArray: "10, 8",
            dashOffset: "0",
            className: `truck-polyline-phase-${phase}`,
          }).addTo(map);

          // Add animated CSS for the dashes
          const style = document.createElement("style");
          style.textContent = `
            .truck-polyline-phase-${phase} {
              animation: dashMove 0.8s linear infinite;
            }
            @keyframes dashMove {
              to { stroke-dashoffset: -18; }
            }
          `;
          document.head.appendChild(style);

          // 2. FROM marker (pulsing source dot)
          const fromMarker = L.circleMarker(from, {
            radius: 8,
            fillColor: color,
            color: "#fff",
            fillOpacity: 1,
            weight: 2,
          }).addTo(map);
          fromMarker.bindTooltip(`📦 ${route.fromName}`, { permanent: false, direction: "top" });

          // 3. TO marker (destination ring)
          const toMarker = L.circleMarker(to, {
            radius: 12,
            fillColor: "transparent",
            color,
            fillOpacity: 0,
            weight: 3,
            dashArray: "4,3",
          }).addTo(map);
          toMarker.bindTooltip(`🏢 ${route.toName}`, { permanent: false, direction: "top" });

          // 4. Animated truck icon
          const truckIcon = L.divIcon({
            className: "",
            html: `<div style="
              font-size:20px;
              line-height:1;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
              transform-origin: center;
            ">🚛</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          const truckMarker = L.marker(from, { icon: truckIcon, zIndexOffset: 1000 }).addTo(map);

          // 5. Animate truck along the line
          const startTime = performance.now();
          let rafId: number;

          function animate(now: number) {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / travelMs, 1);
            // Ease in-out cubic
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

            const lat = lerp(route.fromLat, route.toLat, eased);
            const lng = lerp(route.fromLng, route.toLng, eased);
            truckMarker.setLatLng([lat, lng]);

            if (t < 1) {
              rafId = requestAnimationFrame(animate);
            } else {
              // Truck arrived! Flash effect on destination
              toMarker.setStyle({ fillColor: color, fillOpacity: 0.3, weight: 4 });
              setTimeout(() => {
                toMarker.setStyle({ fillColor: "transparent", fillOpacity: 0, weight: 3 });
              }, 400);
              setTimeout(() => {
                toMarker.setStyle({ fillColor: color, fillOpacity: 0.3, weight: 4 });
              }, 800);

              // Show arrival label
              const arrivalPopup = L.popup({ closeButton: false, autoClose: true, closeOnClick: true })
                .setLatLng(to)
                .setContent(`
                  <div style="font-family:sans-serif;padding:4px;text-align:center">
                    <div style="font-size:18px">✅</div>
                    <div style="font-weight:700;font-size:12px">${route.toName}</div>
                    <div style="font-size:11px;color:#666">${route.totalQuantity} units arrived</div>
                  </div>
                `)
                .openOn(map);

              // Notify parent
              onTruckArrived?.(route);

              // Clean up popup after 3s
              setTimeout(() => map.closePopup(arrivalPopup), 3000);
            }
          }

          rafId = requestAnimationFrame(animate);

          cleanupRef.current.push(() => {
            cancelAnimationFrame(rafId);
            polyline.remove();
            fromMarker.remove();
            toMarker.remove();
            truckMarker.remove();
            style.remove();
          });
        }, startMs);

        phaseTimeoutIds.push(t1);
        cleanupRef.current.push(() => clearTimeout(t1));
      }

      // Each phase waits for the previous phase's trucks to finish + 1s gap
      phaseDelay += travelMs + 1000;
    }

    return () => {
      cleanupRef.current.forEach(fn => fn());
      cleanupRef.current = [];
    };
  }, [map, routes, travelMs, onTruckArrived]);

  return null;
}
