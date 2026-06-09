"use client";

import React from "react";

interface MapErrorBoundaryProps {
  children: React.ReactNode;
}

interface MapErrorBoundaryState {
  hasError: boolean;
}

export default class MapErrorBoundary extends React.Component<
  MapErrorBoundaryProps,
  MapErrorBoundaryState
> {
  constructor(props: MapErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Leaflet Map Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
          <div className="bg-slate-900 border border-red-500/25 rounded-2xl p-6 shadow-2xl max-w-sm flex flex-col items-center gap-4">
            <span className="text-4xl animate-bounce">⚠️</span>
            <h3 className="text-base font-bold text-slate-100">Map failed to load</h3>
            <p className="text-xs text-slate-400">
              An error occurred while rendering the interactive Leaflet map canvas. Please reload to retry.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 px-4 text-xs font-semibold text-white bg-red-650 hover:bg-red-550 rounded-xl transition-colors cursor-pointer shadow-lg shadow-red-600/10"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
