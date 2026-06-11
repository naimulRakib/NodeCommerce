'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import QRScanner from './QRScanner';

// Dynamically import Leaflet components to avoid SSR window is not defined errors
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline), { ssr: false });

export default function DeliveryRouteMap({ route }: { route: any }) {
  const [currentPosition, setCurrentPosition] = useState<{ lat: number, lng: number } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [currentStopOrder, setCurrentStopOrder] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    
    // Get initial
    navigator.geolocation.getCurrentPosition(pos => {
      setCurrentPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });

    // Update every 30 seconds
    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(pos => {
        setCurrentPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (!route || !route.stops || route.stops.length === 0) return null;

  const currentStopIndex = route.stops.findIndex((s: any) => s.status !== 'completed');
  const currentStop = currentStopIndex !== -1 ? route.stops[currentStopIndex] : null;
  const isAllCompleted = currentStopIndex === -1;

  // Polyline positions
  const completedPositions = route.stops
    .filter((s: any) => s.status === 'completed')
    .map((s: any) => [s.buyerLat, s.buyerLng]);
  
  const upcomingPositions = route.stops
    .filter((s: any) => s.status !== 'completed')
    .map((s: any) => [s.buyerLat, s.buyerLng]);

  // If there are completed stops, the last completed connects to the first upcoming
  const connectionLine = completedPositions.length > 0 && upcomingPositions.length > 0 
    ? [completedPositions[completedPositions.length - 1], upcomingPositions[0]] 
    : [];

  const handleMarkArrived = (orderId: string) => {
    setCurrentStopOrder(orderId);
    setShowScanner(true);
  };

  const handleScanComplete = () => {
    setShowScanner(false);
    setCurrentStopOrder(null);
    // In real app, trigger refresh of route data here
    window.location.reload(); 
  };

  if (showScanner && currentStopOrder) {
    return <QRScanner orderId={currentStopOrder} onComplete={handleScanComplete} onCancel={() => setShowScanner(false)} />;
  }

  // Find center (default to first stop)
  const centerLat = route.stops[0]?.buyerLat || 23.8103;
  const centerLng = route.stops[0]?.buyerLng || 90.4125;

  return (
    <div className="flex flex-col h-[600px] bg-white relative">
      <div className="flex-grow z-0">
        <MapContainer center={[centerLat, centerLng]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          
          {/* Stops */}
          {route.stops.map((stop: any, idx: number) => (
            <Marker key={stop.id} position={[stop.buyerLat, stop.buyerLng]}>
              <Popup>
                <div className="p-1">
                  <h3 className="font-bold">{stop.buyerName}</h3>
                  <p className="text-sm">{stop.buyerAddress}</p>
                  <p className="text-xs text-gray-500 mt-1">Status: {stop.status}</p>
                  <p className="text-xs text-blue-600 mt-1">Order: #{stop.order?.orderNumber}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Current GPS position */}
          {currentPosition && (
            <Marker position={[currentPosition.lat, currentPosition.lng]}>
              <Popup>You are here</Popup>
            </Marker>
          )}

          {/* Polylines */}
          {completedPositions.length > 1 && (
            <Polyline positions={completedPositions} color="green" weight={4} opacity={0.7} />
          )}
          {connectionLine.length === 2 && (
            <Polyline positions={connectionLine} color="blue" weight={4} dashArray="10, 10" opacity={0.7} />
          )}
          {upcomingPositions.length > 1 && (
            <Polyline positions={upcomingPositions} color="blue" weight={4} dashArray="10, 10" opacity={0.7} />
          )}
        </MapContainer>
      </div>

      <div className="bg-white border-t p-4 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        {isAllCompleted ? (
          <div className="text-center p-4">
            <h3 className="text-xl font-bold text-green-600">Route Completed! 🎉</h3>
            <p className="text-gray-500">All deliveries finished successfully.</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">
                Stop {currentStopIndex + 1} of {route.stops.length}
              </div>
              <h3 className="text-xl font-bold text-gray-800">{currentStop.buyerName}</h3>
              <p className="text-gray-600 truncate max-w-sm">{currentStop.buyerAddress}</p>
              <div className="text-sm text-blue-600 mt-1 font-medium">
                {currentStop.distanceFromPrev.toFixed(2)} কিমি এই stop পর্যন্ত
              </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <a 
                href={`https://www.google.com/maps/dir/?api=1&destination=${currentStop.buyerLat},${currentStop.buyerLng}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 md:flex-none text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Navigate →
              </a>
              <button 
                onClick={() => handleMarkArrived(currentStop.orderId)}
                className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-colors"
              >
                Mark as Arrived
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
