"use client";

import React from "react";
import dynamic from "next/dynamic";
import MapLoadingSkeleton from "./MapLoadingSkeleton";
import type { TruckRoute } from "./ACOTruckLayer";

// Dynamically import MapClient to prevent Next.js SSR
const MapClient = dynamic(() => import("./MapClient"), {
  ssr: false,
  loading: () => <MapLoadingSkeleton />,
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
}

interface MapWrapperProps {
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
    pheromone?: boolean;
    trucks?: boolean;
  };
  filterDistrict: string;
  onNodeClick: (node: NodeItem) => void;
  pheromoneData?: any;
  showPheromoneLayer?: boolean;
  truckData?: any[];
  /** Live ACO truck animation routes — passed straight to ACOTruckLayer */
  acoRoutes?: TruckRoute[];
  onTruckArrived?: (route: TruckRoute) => void;
}

export default function MapWrapper(props: MapWrapperProps) {
  return <MapClient {...props} />;
}
