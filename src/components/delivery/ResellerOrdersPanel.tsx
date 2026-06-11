'use client';

import { useState, useEffect, useRef } from 'react';
import DeliveryRouteMap from './DeliveryRouteMap';

export default function ResellerOrdersPanel() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'completed' | 'rejected'>('pending');
  const [routeData, setRouteData] = useState<any>(null);
  const [generatingRoute, setGeneratingRoute] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    fetchOrders();
    return () => { isMounted.current = false; };
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/delivery/orders?role=reseller');
      const data = await res.json();
      if (isMounted.current) {
        setOrders(data.orders || []);
        setLoading(false);
      }
    } catch (err) {
      if (isMounted.current) setLoading(false);
    }
  };

  const handleAction = async (orderId: string, action: 'accept' | 'reject', reason?: string) => {
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason: reason })
      });
      if (res.ok) fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateRoute = async () => {
    setGeneratingRoute(true);
    try {
      const res = await fetch('/api/delivery/route/generate', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.route) {
        setRouteData(data.route);
        fetchOrders();
      } else {
        alert(data.error || 'Failed to generate route');
      }
    } catch (err) {
      alert('Error generating route');
    } finally {
      setGeneratingRoute(false);
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const activeOrders = orders.filter(o => o.status === 'accepted' || o.status === 'out_for_delivery');
  const completedOrders = orders.filter(o => o.status === 'delivered');
  const rejectedOrders = orders.filter(o => o.status === 'rejected');

  const pendingCount = pendingOrders.length;

  return (
    <div className="bg-white rounded-lg shadow max-w-5xl mx-auto mt-6 overflow-hidden">
      <div className="flex border-b">
        {(['pending', 'active', 'completed', 'rejected'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 font-medium text-sm transition-colors ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} {tab === 'pending' && pendingCount > 0 && `(${pendingCount})`}
          </button>
        ))}
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading orders...</div>
        ) : (
          <>
            {activeTab === 'pending' && (
              <div className="space-y-4">
                {pendingOrders.length === 0 ? <p className="text-gray-500 text-center py-8">No pending orders.</p> : null}
                {pendingOrders.map(order => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onAccept={() => handleAction(order.id, 'accept')}
                    onReject={() => {
                      const reason = window.prompt("Reason for rejection?");
                      if (reason) handleAction(order.id, 'reject', reason);
                    }}
                  />
                ))}
              </div>
            )}

            {activeTab === 'active' && (
              <div>
                {routeData ? (
                  <div className="mb-6 border rounded-lg overflow-hidden">
                    <DeliveryRouteMap route={routeData} />
                  </div>
                ) : (
                  <div className="mb-6 flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="text-sm text-blue-800">
                      You have <strong>{activeOrders.filter(o => o.status === 'accepted' && !o.routeId).length}</strong> unrouted accepted orders.
                    </div>
                    {activeOrders.filter(o => o.status === 'accepted' && !o.routeId).length >= 2 && (
                      <button
                        onClick={handleGenerateRoute}
                        disabled={generatingRoute}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition-colors"
                      >
                        {generatingRoute ? 'Generating...' : 'Generate Route'}
                      </button>
                    )}
                  </div>
                )}
                
                <div className="space-y-4">
                  {activeOrders.length === 0 ? <p className="text-gray-500 text-center py-8">No active orders.</p> : null}
                  {activeOrders.map(order => <OrderCard key={order.id} order={order} readonly />)}
                </div>
              </div>
            )}

            {activeTab === 'completed' && (
              <div className="space-y-4">
                {completedOrders.length === 0 ? <p className="text-gray-500 text-center py-8">No completed orders.</p> : null}
                {completedOrders.map(order => <OrderCard key={order.id} order={order} readonly showReceipt />)}
              </div>
            )}

            {activeTab === 'rejected' && (
              <div className="space-y-4">
                {rejectedOrders.length === 0 ? <p className="text-gray-500 text-center py-8">No rejected orders.</p> : null}
                {rejectedOrders.map(order => <OrderCard key={order.id} order={order} readonly />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, onAccept, onReject, readonly, showReceipt }: any) {
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);

  useEffect(() => {
    if (readonly || order.status !== 'pending') return;
    
    const createdAt = new Date(order.createdAt).getTime();
    const expiryTime = createdAt + (15 * 60 * 1000);
    
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        // Would ideally trigger auto-reject API here if backend hasn't cron'd it yet
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [order.createdAt, readonly, order.status]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isUrgent = timeLeft < 5 * 60;

  return (
    <div className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-white">
      <div className="flex justify-between items-start mb-3 border-b pb-3">
        <div>
          <h3 className="font-bold text-gray-800 text-lg">{order.buyer?.fullName || order.buyer?.email || 'Customer'}</h3>
          <p className="text-sm text-gray-500 flex items-center mt-1">
            <span className="mr-1">📍</span> {order.buyerAddress}
          </p>
        </div>
        <div className="text-right">
          <div className="font-bold text-xl text-blue-600">BDT {order.totalAmount.toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-1">#{order.orderNumber}</div>
        </div>
      </div>
      
      <div className="mb-4 bg-gray-50 p-3 rounded text-sm">
        <ul className="space-y-1">
          {order.items?.map((item: any) => (
            <li key={item.id} className="flex justify-between">
              <span><span className="font-medium">{item.quantity}x</span> {item.productName}</span>
            </li>
          ))}
        </ul>
      </div>

      {!readonly && (
        <div className="flex items-center justify-between mt-4">
          <div className={`flex items-center text-sm font-bold ${isUrgent ? 'text-red-600 animate-pulse' : 'text-orange-500'}`}>
            ⏱ {mins}:{secs.toString().padStart(2, '0')} মিনিট বাকি
          </div>
          <div className="space-x-3">
            <button onClick={onReject} className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors">
              ✗ Reject
            </button>
            <button onClick={onAccept} disabled={timeLeft === 0} className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-bold shadow-sm transition-colors">
              ✓ Accept
            </button>
          </div>
        </div>
      )}

      {readonly && order.status === 'rejected' && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          Reason: {order.rejectionReason || 'Unknown'}
        </div>
      )}

      {showReceipt && order.receiptUrl && (
        <div className="mt-4 border-t pt-4 text-right">
          <a href={`/api/delivery/receipt/${order.id}`} target="_blank" className="text-sm text-blue-600 font-medium hover:underline">
            📄 View Receipt
          </a>
        </div>
      )}
    </div>
  );
}
