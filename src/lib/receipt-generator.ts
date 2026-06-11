export function generateReceiptHTML(params: {
  order: any; // Type accurately based on your Prisma generated types
  buyer: any;
  reseller: any;
  deliveredAt: Date;
}): string {
  const { order, buyer, reseller, deliveredAt } = params;

  const formattedDate = deliveredAt.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const itemsHtml = order.items.map((item: any) => `
    <tr>
      <td>${item.productName}</td>
      <td>${item.productCode}</td>
      <td>${item.quantity}</td>
      <td>BDT ${item.priceAtOrder.toFixed(2)}</td>
      <td>BDT ${(item.quantity * item.priceAtOrder).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Receipt #${order.orderNumber}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; color: #333; }
      .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
      .logo { font-size: 28px; font-weight: bold; color: #2563EB; margin-bottom: 5px; }
      .receipt-number { color: #666; font-size: 16px; margin-bottom: 5px; }
      .date { font-size: 14px; color: #888; }
      
      .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
      .buyer-info, .reseller-info { width: 45%; }
      .info-title { font-weight: bold; margin-bottom: 10px; font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
      
      .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
      .items-table th { background-color: #f8f9fa; text-align: left; }
      .items-table th, .items-table td { border: 1px solid #ddd; padding: 12px 8px; }
      
      .total-section { text-align: right; margin-bottom: 40px; }
      .total { font-weight: bold; font-size: 22px; color: #000; }
      
      .footer { text-align: center; color: #666; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; }
      .bengali { font-family: sans-serif; font-weight: bold; margin-bottom: 5px; color: #2563EB; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="logo">NodeCommerce</div>
      <div class="receipt-number">Receipt #${order.orderNumber}</div>
      <div class="date">Date: ${formattedDate}</div>
    </div>
    
    <div class="info-section">
      <div class="buyer-info">
        <div class="info-title">Billed To:</div>
        <div><strong>${buyer.fullName || buyer.email}</strong></div>
        <div>${order.buyerAddress}</div>
        ${buyer.phone ? `<div>Phone: ${buyer.phone}</div>` : ''}
      </div>
      
      <div class="reseller-info">
        <div class="info-title">Sold By:</div>
        <div><strong>${reseller.username}</strong></div>
        <div>Reseller Code: ${reseller.resellerCode}</div>
        <div>${reseller.city}, ${reseller.upazilla}</div>
      </div>
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Code</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    
    <div class="total-section">
      <div class="total">Total: BDT ${order.totalAmount.toFixed(2)}</div>
    </div>
    
    <div class="footer">
      <div class="bengali">ধন্যবাদ! আবার কিনুন।</div>
      <div>NodeCommerce Bangladesh</div>
      <div style="margin-top: 5px; font-size: 12px; color: #aaa;">This is a system generated receipt.</div>
    </div>
    <script>
      // Trigger print automatically when opened, useful for quick saving as PDF
      window.onload = function() { window.print(); }
    </script>
  </body>
  </html>
  `;
}
