"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import StatsSummary from "@/components/superdashboard/StatsSummary";
import LayerControls from "@/components/superdashboard/LayerControls";
import SearchFilter from "@/components/superdashboard/SearchFilter";
import NodeDetailPanel from "@/components/superdashboard/NodeDetailPanel";
import MapErrorBoundary from "@/components/superdashboard/MapErrorBoundary";
import dynamic from "next/dynamic";

const MapWrapper = dynamic(
  () => import("@/components/superdashboard/MapWrapper"),
  { ssr: false }
);

import ACOPipelinePanel from "@/components/superdashboard/ACOPipelinePanel";
import ACOTriggerControl from "@/components/superdashboard/ACOTriggerControl";
import GlobalACOControl from "@/components/superdashboard/GlobalACOControl";
import SupplyChainControls from "@/components/superdashboard/SupplyChainControls";
import ShipmentPipelinePanel from "@/components/superdashboard/ShipmentPipelinePanel";
import MultiProductPheromoneLayer from "@/components/superdashboard/MultiProductPheromoneLayer";
import RunIntelligenceControl from "@/components/superdashboard/RunIntelligenceControl";
import AgentStatusPanel from "@/components/superdashboard/AgentStatusPanel";

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

interface AllNodesState {
  sellers: NodeItem[];
  localResellers: NodeItem[];
  upazillaResellers: NodeItem[];
  districtResellers: NodeItem[];
}

interface SummaryState {
  totalSellers: number;
  totalLocalResellers: number;
  totalUpazillaResellers: number;
  totalDistrictResellers: number;
  totalNodes: number;
}

export default function SuperDashboardPage() {
  // ----------------------------------------------------
  // STATES
  // ----------------------------------------------------
  const [allNodes, setAllNodes] = useState<AllNodesState>({
    sellers: [],
    localResellers: [],
    upazillaResellers: [],
    districtResellers: [],
  });
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(null);
  
  const [visibleLayers, setVisibleLayers] = useState({
    seller: true,
    local_reseller: true,
    upazilla_reseller: true,
    district_reseller: true,
    pheromone: false,
    trucks: true,
  });

  const [pheromoneData, setPheromoneData] = useState<any>(null);
  const [showPheromoneLayer, setShowPheromoneLayer] = useState<boolean>(false);
  const [acoJobs, setAcoJobs] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [conservationViolations, setConservationViolations] = useState<any[]>([]);

  const [truckData, setTruckData] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterDistrict, setFilterDistrict] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Mobile UI States
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // ----------------------------------------------------
  // DATA FETCHING, JITTER, & SYNC
  // ----------------------------------------------------
  const fetchNodes = async (isMounted: boolean = true) => {
    try {
      setError(null);
      const res = await fetch("/api/superdashboard/nodes");
      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }
      const data = await res.json();
      
      // Jitter coordinate offset helper (0.005 ~ 500m spread)
      const jitter = (coord: number) => coord + (Math.random() - 0.5) * 0.005;

      // Apply jitter offset once on load to sellers and local resellers only
      const mapJitteredNodes = (nodesList: NodeItem[]) => {
        return (nodesList || []).map((node) => ({
          ...node,
          lat: jitter(node.lat),
          lng: jitter(node.lng),
        }));
      };

      if (isMounted) {
        setAllNodes({
          sellers: mapJitteredNodes(data.sellers),
          localResellers: mapJitteredNodes(data.localResellers),
          upazillaResellers: data.upazillaResellers || [],
          districtResellers: data.districtResellers || [],
        });
        setSummary(data.summary || null);
        setLastUpdated(new Date());
      }

      // Fetch ACO specific data
      try {
        const [pheromonesRes, activeJobsRes, pendingJobsRes, conservationRes] = await Promise.all([
          fetch("/api/aco/pheromones"),
          fetch("/api/aco/jobs?status=running"),
          fetch("/api/aco/jobs?status=completed_pending_approval"),
          fetch("/api/aco/verify-conservation")
        ]);

        if (pheromonesRes.ok) {
          const pheromones = await pheromonesRes.json();
          if (isMounted) setPheromoneData(pheromones);
        }

        if (conservationRes.ok) {
          const cvData = await conservationRes.json();
          if (isMounted) {
            if (cvData.violations && cvData.violations.length > 0) {
              setConservationViolations(cvData.violations);
            } else {
              setConservationViolations([]);
            }
          }
        }

        let combinedJobs: any[] = [];
        let approvals: any[] = [];

        if (activeJobsRes.ok) {
          const resJson = await activeJobsRes.json();
          if (resJson.jobs) combinedJobs = [...combinedJobs, ...resJson.jobs];
        }
        
        if (pendingJobsRes.ok) {
          const resJson = await pendingJobsRes.json();
          if (resJson.jobs) {
            combinedJobs = [...combinedJobs, ...resJson.jobs];
            resJson.jobs.forEach((j: any) => {
              if (j.interDistrict && j.interDistrict.length > 0) {
                approvals = [...approvals, ...j.interDistrict.filter((o: any) => o.status === "pending_approval")];
              }
            });
          }
        }
        
        // Let's also fetch completed jobs just for the panel
        const completedRes = await fetch("/api/aco/jobs?status=completed&limit=5");
        if (completedRes.ok) {
           const completedJson = await completedRes.json();
           if (completedJson.jobs) combinedJobs = [...combinedJobs, ...completedJson.jobs];
        }

        if (isMounted) {
          setAcoJobs(combinedJobs);
          setPendingApprovals(approvals);
        }
        
        if (visibleLayers.trucks) {
          const trucksRes = await fetch("/api/aco/trucks?jobId=latest");
          if (trucksRes.ok) {
            const tJson = await trucksRes.json();
            if (isMounted) setTruckData(tJson.trucks || []);
          }
        } else {
          if (isMounted) setTruckData([]);
        }

      } catch (err) {
        console.error("Failed to fetch ACO data", err);
      }

    } catch (err: any) {
      console.error("Failed to fetch dashboard nodes:", err);
      if (isMounted) setError(err?.message || "An unexpected error occurred while loading map nodes.");
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Initial load
    fetchNodes(isMounted);

    // Auto-refresh every 120 seconds, but skip when tab is hidden
    // to reduce CPU/network usage and prevent heating
    const intervalId = setInterval(() => {
      if (isMounted && !document.hidden) {
        fetchNodes(isMounted);
      }
    }, 120_000);

    // Also refresh when the tab becomes visible again after being hidden
    const handleVisibilityChange = () => {
      if (!document.hidden && isMounted) {
        fetchNodes(isMounted);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // ----------------------------------------------------
  // FILTERING LOGIC
  // ----------------------------------------------------
  const filteredNodes = useMemo(() => {
    const combined: NodeItem[] = [
      ...allNodes.sellers,
      ...allNodes.localResellers,
      ...allNodes.upazillaResellers,
      ...allNodes.districtResellers,
    ];

    let temp = combined;

    // 1. Apply Search Query (Name, upazilla, district, city)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      temp = temp.filter((node) => {
        const nameMatch = node.name?.toLowerCase().includes(q);
        const upzMatch = node.upazilla?.toLowerCase().includes(q);
        const distMatch = node.district?.toLowerCase().includes(q);
        const cityMatch = node.city?.toLowerCase().includes(q);
        return nameMatch || upzMatch || distMatch || cityMatch;
      });
    }

    // 2. Apply District Filter
    // - Upazilla, local, and seller match by city
    // - District reseller matches by district
    if (filterDistrict) {
      const targetDist = filterDistrict.toLowerCase().trim();
      temp = temp.filter((node) => {
        if (node.type === "district_reseller") {
          return node.district?.toLowerCase().trim() === targetDist;
        } else {
          return node.city?.toLowerCase().trim() === targetDist;
        }
      });
    }

    // 3. Apply Node Type Filter
    if (filterType) {
      temp = temp.filter((node) => node.type === filterType);
    }

    // Split back into typed arrays for MapClient/MapWrapper
    const sellers = temp.filter((n) => n.type === "seller");
    const localResellers = temp.filter((n) => n.type === "local_reseller");
    const upazillaResellers = temp.filter((n) => n.type === "upazilla_reseller");
    const districtResellers = temp.filter((n) => n.type === "district_reseller");

    return { sellers, localResellers, upazillaResellers, districtResellers };
  }, [allNodes, searchQuery, filterDistrict, filterType]);

  // Check if current filter produces empty results
  const hasNoResults = useMemo(() => {
    return (
      filteredNodes.sellers.length === 0 &&
      filteredNodes.localResellers.length === 0 &&
      filteredNodes.upazillaResellers.length === 0 &&
      filteredNodes.districtResellers.length === 0
    );
  }, [filteredNodes]);

  // Deduplicated node counts for LayerControls
  const layerCounts = useMemo(() => {
    return {
      seller: allNodes.sellers.length,
      local_reseller: allNodes.localResellers.length,
      upazilla_reseller: allNodes.upazillaResellers.length,
      district_reseller: allNodes.districtResellers.length,
    };
  }, [allNodes]);

  // ----------------------------------------------------
  // HANDLERS (Callback Audited)
  // ----------------------------------------------------
  const handleLayerToggle = useCallback((layerKey: keyof typeof visibleLayers) => {
    setVisibleLayers((prev) => {
      const newVal = !prev[layerKey];
      if (layerKey === "pheromone") {
        setShowPheromoneLayer(newVal);
      }
      return {
        ...prev,
        [layerKey]: newVal,
      };
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setFilterDistrict("");
    setFilterType("");
  }, []);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
  }, []);

  const handleFilterDistrict = useCallback((d: string) => {
    setFilterDistrict(d);
  }, []);

  const handleFilterType = useCallback((t: string) => {
    setFilterType(t);
  }, []);

  const handleNodeClick = useCallback((node: NodeItem) => {
    setSelectedNode(node);
  }, []);

  const handleDetailClose = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleMobileSidebarOpen = useCallback(() => {
    setMobileSidebarOpen(true);
  }, []);

  const handleMobileSidebarClose = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  const formatTime = (date: Date | null) => {
    if (!date) return "--:--:--";
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  // Live total nodes based on db summary
  const totalNodesInDb = summary?.totalNodes || 0;

  // ----------------------------------------------------
  // CONDITIONAL RENDER STATES
  // ----------------------------------------------------

  // Full-page Loading State
  if (loading && totalNodesInDb === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
        {/* Simple decorative Bangladesh outline SVG */}
        <svg
          className="w-32 h-32 text-orange-500/20 mb-6 animate-pulse"
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            d="M 50,15 C 60,18 70,12 75,25 C 80,38 72,55 78,65 C 84,75 72,90 60,85 C 48,80 35,92 25,80 C 15,68 22,50 18,38 C 14,26 30,22 40,25 C 45,26 48,12 50,15 Z"
            fill="currentColor"
            fillOpacity="0.05"
          />
          <circle cx="50" cy="50" r="4" fill="#10B981" />
          <circle cx="35" cy="40" r="3" fill="#3B82F6" />
          <circle cx="65" cy="60" r="3" fill="#7C3AED" />
          <circle cx="58" cy="30" r="3.5" fill="#F59E0B" />
        </svg>

        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-orange-500 border-t-transparent animate-spin" />
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">
            Loading supply chain map...
          </h2>
          <p className="text-xs text-slate-400 max-w-[280px]">
            Compiling seller locations and reseller centroids across Bangladesh.
          </p>
        </div>
      </div>
    );
  }

  // Error State
  if (error && totalNodesInDb === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-6">
        <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 text-3xl">
            ⚠️
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Failed to load map data</h3>
            <p className="text-xs text-red-400 mt-2 font-mono break-all">{error}</p>
          </div>
          <button
            onClick={fetchNodes}
            className="w-full py-2.5 px-4 font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all cursor-pointer shadow-lg shadow-red-600/20"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN ASSEMBLY
  // ----------------------------------------------------
  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 relative overflow-hidden text-slate-100 font-sans">
      {/* 1. HEADER BAR */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 z-20 shrink-0 select-none">
        {/* Left branding */}
        <div className="flex items-center gap-3">
          <span className="text-2xl text-orange-500 font-bold">⬡</span>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-slate-100 tracking-tight leading-none">
              NodeCommerce
            </h1>
            <p className="text-[10px] text-slate-450 tracking-wider uppercase font-semibold mt-0.5">
              Supply Chain Map
            </p>
          </div>
        </div>

        {/* Right status */}
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-300">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-emerald-400 font-bold tracking-wide uppercase text-[9px]">
              Live
            </span>
          </div>

          <div className="hidden md:block text-slate-400 font-medium">
            Last updated: <span className="font-mono text-slate-200">{formatTime(lastUpdated)}</span>
          </div>

          {pendingApprovals.length > 0 && (
            <div className="hidden lg:flex items-center gap-2 bg-amber-500/20 border border-amber-500/50 text-amber-400 px-3 py-1.5 rounded-lg font-bold">
              <span>⚡</span> {pendingApprovals.length} inter-district approvals pending
            </div>
          )}

          <button
            onClick={fetchNodes}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-850 hover:bg-slate-800 text-slate-250 border border-slate-700/60 rounded-lg px-3 py-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <span>🔄</span>
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <span className="px-3 py-1.5 rounded-lg bg-orange-600/15 border border-orange-500/25 text-orange-400 font-bold uppercase tracking-wider text-[10px]">
            {totalNodesInDb} nodes
          </span>
        </div>
      </header>

      {/* Edge Case 55: Conservation Violation Banner */}
      {conservationViolations.length > 0 && (
        <div className="w-full bg-red-900 border-b border-red-500 text-red-100 p-3 px-6 flex items-center justify-between z-30 shrink-0 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="font-bold text-sm">Conservation violation detected in {conservationViolations.length} Job(s).</div>
              <div className="text-xs text-red-300">
                Job {String(conservationViolations[0].jobId || "").slice(0, 8)}: {conservationViolations[0].expected} units expected, {conservationViolations[0].actual} accounted. Discrepancy: {conservationViolations[0].discrepancy} units. Admin review required.
              </div>
            </div>
          </div>
          <button className="bg-red-950 hover:bg-red-800 text-xs font-bold py-1.5 px-3 rounded border border-red-500/50 transition-colors">
            View Details
          </button>
        </div>
      )}

      {/* 2. BODY CONTENT (Sidebar + Map Area) */}
      <div className="flex-1 flex overflow-hidden relative w-full">
        {/* Desktop Sidebar (Left side, width 320px, full height, independently scrollable) */}
        <aside className="hidden md:flex flex-col w-[320px] h-full overflow-y-auto border-r border-slate-850 bg-slate-900/40 p-5 gap-5 shrink-0 scrollbar-thin">
          {summary && <StatsSummary summary={summary} />}
          <LayerControls
            visibleLayers={visibleLayers}
            onToggle={handleLayerToggle}
            counts={layerCounts}
          />
          <SearchFilter
            onSearch={handleSearch}
            onFilterDistrict={handleFilterDistrict}
            onFilterType={handleFilterType}
          />
        </aside>

        {/* Map Area */}
        <main className="flex-1 h-full relative overflow-hidden flex flex-row">
          {/* Main Map Component */}
          <div className="flex-1 h-full relative z-0">
            <MapErrorBoundary>
              <MapWrapper
                nodes={filteredNodes}
                visibleLayers={visibleLayers}
                filterDistrict={filterDistrict}
                onNodeClick={handleNodeClick}
                pheromoneData={pheromoneData}
                showPheromoneLayer={visibleLayers.pheromone}
                truckData={truckData}
              />
            </MapErrorBoundary>

            <ACOTriggerControl
              onJobComplete={(job) => {
                setAcoJobs(prev => [job, ...prev]);
                fetchNodes();
              }}
            />

            <RunIntelligenceControl />
            <AgentStatusPanel />

            <GlobalACOControl
              onJobComplete={(job) => {
                setAcoJobs(prev => [job, ...prev]);
                fetchNodes();
              }}
            />

            <SupplyChainControls
              onReset={() => {
                setAcoJobs([]);
                setPendingApprovals([]);
                setConservationViolations([]);
                setTruckData([]);
                fetchNodes();
              }}
            />

            <MultiProductPheromoneLayer active={showPheromoneLayer} />

            {/* Empty State Overlay */}
            {hasNoResults && (
              <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center max-w-sm flex flex-col items-center gap-3">
                  <span className="text-4xl">🔎</span>
                  <h4 className="text-base font-bold text-slate-100">No nodes match your filters</h4>
                  <p className="text-xs text-slate-400">
                    Try adjusting your search query or selecting a different district/type combination.
                  </p>
                  <button
                    onClick={handleClearFilters}
                    className="mt-1 px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-xl transition-colors cursor-pointer shadow-lg shadow-orange-600/10"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Node Detail Side-Panel (Desktop width: 320px right pane, Mobile: 50vh bottom sheet) */}
          <NodeDetailPanel
            node={selectedNode}
            onClose={handleDetailClose}
          />
          
          <div className="hidden xl:block">
            <ACOPipelinePanel
              jobs={acoJobs}
              pendingApprovals={pendingApprovals}
              onApprovalAction={fetchNodes}
            />
          </div>

          <div className="hidden xl:block mt-4">
            <ShipmentPipelinePanel refreshKey={lastUpdated?.getTime() ?? 0} />
          </div>
        </main>
      </div>

      {/* 3. MOBILE FLOATING ACTION & BOTTOM DRAWER */}
      {/* Floating filters button on mobile (Fixed bottom-left, purple bg, opens bottom sheet) */}
      <div className="fixed bottom-4 left-4 z-40 md:hidden">
        <button
          onClick={handleMobileSidebarOpen}
          className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs tracking-wider uppercase px-4 py-2.5 rounded-full shadow-2xl border border-purple-500/20 cursor-pointer transition-all duration-200 active:scale-95"
        >
          <span>⚙️</span> Filters
        </button>
      </div>

      {/* Bottom Sheet Drawer Backdrop (Mobile) */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-45 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300"
          onClick={handleMobileSidebarClose}
        />
      )}

      {/* Bottom Sheet Drawer (Mobile, 60vh height, slides up) */}
      <div
        className={`
          fixed inset-x-0 bottom-0 z-50 bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 shadow-2xl transition-transform duration-300 ease-in-out h-[60vh] overflow-y-auto flex flex-col gap-5
          ${mobileSidebarOpen ? "translate-y-0" : "translate-y-full"}
          md:hidden
        `}
      >
        {/* Handle bar */}
        <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-1 shrink-0" onClick={handleMobileSidebarClose} />
        
        {/* Drawer header */}
        <div className="flex items-center justify-between shrink-0">
          <h3 className="font-bold text-slate-100 text-sm tracking-wide uppercase">Filters & Layers</h3>
          <button
            onClick={handleMobileSidebarClose}
            className="w-7 h-7 rounded-full bg-slate-850 hover:bg-slate-800 flex items-center justify-center text-slate-450 font-bold text-xs cursor-pointer border border-slate-750"
          >
            ✕
          </button>
        </div>

        {/* Drawer content */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-5 pb-8 scrollbar-thin">
          {summary && <StatsSummary summary={summary} />}
          <LayerControls
            visibleLayers={visibleLayers}
            onToggle={handleLayerToggle}
            counts={layerCounts}
          />
          <SearchFilter
            onSearch={handleSearch}
            onFilterDistrict={handleFilterDistrict}
            onFilterType={handleFilterType}
          />
        </div>
      </div>
    </div>
  );
}
