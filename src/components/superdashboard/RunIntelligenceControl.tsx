import React, { useState } from 'react';

export default function RunIntelligenceControl() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRunIntelligence = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/agent/trigger-intelligence', { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      setResult({ error: 'Failed to run intelligence' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute top-20 right-80 z-40 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-xl w-72">
      <h3 className="text-white font-bold mb-2 flex items-center gap-2">
        <span>🧠</span> AI Intelligence
      </h3>
      <p className="text-slate-400 text-xs mb-4">
        Trigger Demand Generation, PROVA, FORESIGHT, and REORDER manually.
      </p>
      
      <button 
        onClick={handleRunIntelligence}
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 text-white font-bold py-2 rounded-lg transition-colors"
      >
        {loading ? 'Running...' : 'Run Intelligence'}
      </button>

      {result && (
        <div className="mt-3 p-3 bg-slate-800 rounded border border-slate-700 max-h-40 overflow-y-auto">
          {result.error ? (
            <div className="text-red-400 text-xs">{result.error}</div>
          ) : (
            <div className="text-xs text-slate-300 space-y-1 font-mono">
              <div>Demands Injected: <span className="text-emerald-400">{result.demandsGenerated}</span></div>
              <div>Alerts: <span className="text-amber-400">{result.alerts?.length || 0}</span></div>
              <div>Forecasts: <span className="text-blue-400">{result.forecasts?.length || 0}</span></div>
              <div>Reorders: <span className="text-purple-400">{result.actions?.length || 0}</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
