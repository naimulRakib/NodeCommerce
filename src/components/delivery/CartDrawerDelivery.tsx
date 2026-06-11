'use client';

import { useState } from 'react';
import { useCart } from '@/lib/cartContext'; // Mock context
import { QRCodeSVG } from 'qrcode.react'; // Assuming this is installed

export default function CartDrawerDelivery() {
  const { cartItems, clearCart } = useCart?.() || { cartItems: [], clearCart: () => {} };
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'WALLET'>('COD');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ qrCode: string, message: string } | null>(null);

  const calculateTotal = () => cartItems.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
  
  // In a real implementation, we'd fetch buyer's default location and address here
  const buyerLat = 23.8103; 
  const buyerLng = 90.4125;

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setLoading(true);
    setError(null);
    
    try {
      const payload = {
        items: cartItems.map((item: any) => ({
          stockItemId: item.stockItemId,
          resellerId: item.resellerId,
          quantity: item.quantity
        })),
        buyerLat,
        buyerLng,
        buyerAddress: deliveryType === 'delivery' ? buyerAddress : 'Pickup',
        deliveryType,
        paymentMethod
      };

      const res = await fetch('/api/delivery/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      
      setSuccessData({ qrCode: data.qrCode, message: data.message });
      clearCart();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg max-w-sm mx-auto text-center border-t-4 border-green-500">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Placed!</h2>
        <p className="text-gray-600 mb-6">{successData.message}</p>
        
        <div className="bg-gray-50 p-4 rounded-xl inline-block border border-gray-200">
          <QRCodeSVG value={successData.qrCode} size={200} />
        </div>
        <p className="text-sm font-medium text-blue-600 mt-4">এই QR code delivery person দেখান</p>
        <p className="text-xs text-gray-400 mt-1">(Please show this QR code upon delivery)</p>
        
        <button 
          onClick={() => setSuccessData(null)}
          className="mt-6 w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border-l shadow-2xl h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Your Cart</h2>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm border border-red-200">
          {error}
        </div>
      )}

      <div className="flex-grow overflow-y-auto pr-2">
        {cartItems.length === 0 ? (
          <p className="text-gray-500 text-center py-10">Cart is empty.</p>
        ) : (
          cartItems.map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <h4 className="font-semibold text-gray-800">{item.productName}</h4>
                <div className="text-xs text-gray-500 mt-1">From: {item.resellerName}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-blue-600">BDT {item.price.toFixed(2)}</div>
                <div className="text-xs text-gray-500">Qty: {item.quantity}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {cartItems.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${deliveryType === 'delivery' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
              onClick={() => setDeliveryType('delivery')}
            >
              🚚 Delivery
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${deliveryType === 'pickup' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
              onClick={() => setDeliveryType('pickup')}
            >
              🏪 Pickup
            </button>
          </div>

          {deliveryType === 'delivery' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
              <textarea
                value={buyerAddress}
                onChange={(e) => setBuyerAddress(e.target.value)}
                placeholder="Enter your full address..."
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                rows={2}
              />
            </div>
          )}

          <div className="flex justify-between font-bold text-lg mb-4 text-gray-800 bg-blue-50 p-3 rounded-lg border border-blue-100">
            <span>Total Amount</span>
            <span>BDT {calculateTotal().toFixed(2)}</span>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <div className="flex gap-2">
              <label className={`flex-1 border rounded-lg p-2 text-center cursor-pointer transition-colors ${paymentMethod === 'COD' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white text-gray-600'}`}>
                <input type="radio" name="payment" value="COD" checked={paymentMethod === 'COD'} onChange={() => setPaymentMethod('COD')} className="hidden" />
                Cash on Delivery
              </label>
              <label className={`flex-1 border rounded-lg p-2 text-center cursor-pointer transition-colors ${paymentMethod === 'WALLET' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white text-gray-600'}`}>
                <input type="radio" name="payment" value="WALLET" checked={paymentMethod === 'WALLET'} onChange={() => setPaymentMethod('WALLET')} className="hidden" />
                Node Wallet
              </label>
            </div>
          </div>
          
          <button
            onClick={handleCheckout}
            disabled={loading || (deliveryType === 'delivery' && !buyerAddress.trim())}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98]"
          >
            {loading ? 'Processing...' : 'Confirm Order'}
          </button>
        </div>
      )}
    </div>
  );
}
