import { createHmac } from 'crypto';
import { QR_SECRET } from '@/lib/env';

export function generateOrderQR(params: {
  orderNumber: string;
  buyerId: string;
  resellerId: string;
}): string {
  const { orderNumber, buyerId, resellerId } = params;
  const timestamp = Date.now().toString();
  const data = `${orderNumber}_${buyerId}_${resellerId}_${timestamp}`;
  
  const signature = createHmac('sha256', QR_SECRET)
    .update(data)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  
  return `${data}_${signature}`;
}

export function verifyOrderQR(qrString: string): {
  valid: boolean;
  orderNumber?: string;
  buyerId?: string;
  resellerId?: string;
  expired?: boolean;
} {
  try {
    const parts = qrString.split('_');
    
    // Format: ORD001_BUY123_RES456_1234567890_ABC12345
    // Actually orderNumber might contain hyphens, e.g., ORD-2024-001. So splitting by '_' works if orderNumber doesn't contain '_'
    // The prompt format: orderNumber + '_' + buyerId + '_' + resellerId + '_' + timestamp + '_' + signature
    if (parts.length < 5) return { valid: false };

    const signature = parts.pop()!;
    const timestamp = parts.pop()!;
    const resellerId = parts.pop()!;
    const buyerId = parts.pop()!;
    // Whatever is left is the order number
    const orderNumber = parts.join('_');

    const data = `${orderNumber}_${buyerId}_${resellerId}_${timestamp}`;
    const expectedSignature = createHmac('sha256', QR_SECRET)
      .update(data)
      .digest('hex')
      .slice(0, 8)
      .toUpperCase();

    if (signature !== expectedSignature) {
      return { valid: false };
    }

    const timeDiffMs = Date.now() - parseInt(timestamp, 10);
    const expired = timeDiffMs > 48 * 60 * 60 * 1000; // > 48 hours old

    return {
      valid: true,
      orderNumber,
      buyerId,
      resellerId,
      expired
    };
  } catch (error) {
    return { valid: false };
  }
}
