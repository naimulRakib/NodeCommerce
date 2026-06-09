/**
 * Encoded QR payload: sellerCode_productCode_price
 * @param {string} sellerCode
 * @param {string} productCode
 * @param {number|string} price
 * @returns {string}
 */
// lib/qr.js
export function buildQRString(sellerCode: any, globalProductId: unknown, basePrice: any, ratingDensity = 0) {
  // Matches requested format: sellerCode_globalProductId_price_ratingDensity
  return `${sellerCode}_${globalProductId}_${basePrice}_${ratingDensity}`;
}
