import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DRIVER_NAMES = [
  "মো. রফিকুল ইসলাম", "মো. আব্দুল করিম", "মো. জহিরুল হক",
  "মো. আলমগীর হোসেন", "মো. সালাউদ্দিন", "মো. নূরে আলম",
];
const DRIVER_PHONES = [
  "01712-345678", "01812-456789", "01912-567890",
  "01612-678901", "01512-789012",
];
const TRUCK_PLATES = ["ঢাকা-চ ১১-৩৪৫৬", "কুমিল্লা-ক ৫৫-৭৮৯০", "চট্টগ্রাম-গ ২২-১১২৩", "ময়মনসিংহ-ঘ ৩৩-৪৫৬৭"];
const AGENCIES = ["বাংলাদেশ ট্রান্সপোর্ট সার্ভিস", "যমুনা লজিস্টিকস", "মেঘনা ক্যারিয়ার", "পদ্মা ট্রাক সার্ভিস"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * POST /api/uipath/delivery-manifest
 * Generates an HTML delivery manifest (saved as PDF by browser).
 * 
 * Body: {
 *   shipmentId: string,
 *   phase: number,
 *   fromName: string,
 *   toName: string,
 *   totalQuantity: number,
 *   products: { name: string, qty: number }[],
 *   type: "dispatch" | "arrival"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      shipmentId,
      phase,
      fromName,
      toName,
      totalQuantity,
      products = [],
      type = "dispatch",
    } = body;

    const driver = pick(DRIVER_NAMES);
    const phone = pick(DRIVER_PHONES);
    const plate = pick(TRUCK_PLATES);
    const agency = pick(AGENCIES);
    const now = new Date().toLocaleString("bn-BD", {
      timeZone: "Asia/Dhaka",
      dateStyle: "full",
      timeStyle: "short",
    });

    const phaseLabel = phase === 1 ? "বিক্রেতা → উপজেলা হাব" : phase === 2 ? "উপজেলা হাব → জেলা হাব" : `ধাপ ${phase}`;
    const typeLabel = type === "dispatch" ? "প্রেরণ মেনিফেস্ট" : "গ্রহণ মেনিফেস্ট";

    const productRows = (products.length > 0 ? products : [{ name: "Premium Miniket Rice (50kg)", qty: totalQuantity }])
      .map((p: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? "#f8f9fa" : "#ffffff"}">
          <td style="padding:8px 12px;border:1px solid #dee2e6">${i + 1}</td>
          <td style="padding:8px 12px;border:1px solid #dee2e6;font-weight:600">${p.name}</td>
          <td style="padding:8px 12px;border:1px solid #dee2e6;text-align:center">${p.qty ?? p.quantity ?? 0}</td>
          <td style="padding:8px 12px;border:1px solid #dee2e6;text-align:center">ভালো অবস্থায়</td>
        </tr>
      `).join("");

    const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>NodeCommerce ডেলিভারি মেনিফেস্ট #${shipmentId?.slice(0, 8) ?? "DEMO"}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #212529; font-size: 13px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #6610f2; padding-bottom:16px; margin-bottom:20px; }
    .logo { font-size:22px; font-weight:800; color:#6610f2; }
    .logo span { color:#20c997; }
    .doc-type { background:#6610f2; color:#fff; padding:6px 16px; border-radius:20px; font-size:12px; font-weight:700; }
    .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; }
    .meta-box { background:#f8f9fa; border:1px solid #dee2e6; border-radius:8px; padding:12px; }
    .meta-box h4 { margin:0 0 8px 0; font-size:11px; text-transform:uppercase; color:#6c757d; letter-spacing:0.8px; }
    .meta-box p { margin:3px 0; font-weight:600; font-size:13px; }
    .route-banner { background:linear-gradient(135deg,#6610f2,#20c997); color:#fff; border-radius:10px; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; font-weight:700; }
    .route-arrow { font-size:22px; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    thead tr { background:#6610f2; color:#fff; }
    thead th { padding:10px 12px; text-align:left; font-size:12px; border:1px solid #6610f2; }
    .footer { display:flex; justify-content:space-between; border-top:2px solid #dee2e6; padding-top:16px; font-size:11px; color:#6c757d; }
    .sig-box { text-align:center; border-top:1px solid #999; width:160px; padding-top:6px; font-size:11px; }
    .badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; }
    .badge-green { background:#d4edda; color:#155724; }
    .badge-blue { background:#cce5ff; color:#004085; }
    .uipath-seal { background:#fa4616; color:#fff; padding:3px 10px; border-radius:4px; font-size:10px; font-weight:700; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Node<span>Commerce</span> BD</div>
      <div style="font-size:11px;color:#6c757d;margin-top:3px">বাংলাদেশের সরবরাহ শৃঙ্খল ব্যবস্থাপনা</div>
    </div>
    <div style="text-align:right">
      <div class="doc-type">${typeLabel}</div>
      <div style="font-size:11px;color:#6c757d;margin-top:6px">ID: #${shipmentId?.slice(0, 10) ?? "DEMO-0001"}</div>
      <div style="font-size:11px;color:#6c757d">${now}</div>
      <div style="margin-top:4px"><span class="uipath-seal">🤖 UiPath এজেন্ট কর্তৃক তৈরি</span></div>
    </div>
  </div>

  <div class="route-banner">
    <div>
      <div style="font-size:12px;opacity:0.85;font-weight:400">সরবরাহ পথ · Supply Route (${phaseLabel})</div>
      <div style="font-size:15px;margin-top:2px">📍 ${fromName}</div>
    </div>
    <div class="route-arrow">🚛 ➡</div>
    <div style="text-align:right">
      <div style="font-size:12px;opacity:0.85;font-weight:400">গন্তব্য · Destination</div>
      <div style="font-size:15px;margin-top:2px">🏢 ${toName}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <h4>🚗 ড্রাইভার তথ্য</h4>
      <p>${driver}</p>
      <p style="color:#6c757d;font-weight:400">${phone}</p>
      <p style="margin-top:4px;font-size:11px">নম্বর প্লেট: <strong>${plate}</strong></p>
    </div>
    <div class="meta-box">
      <h4>🏢 পরিবহন সংস্থা</h4>
      <p>${agency}</p>
      <p style="color:#6c757d;font-weight:400">বুকিং রেফ: NC-${Date.now().toString().slice(-6)}</p>
      <p style="margin-top:4px"><span class="badge badge-green">✅ নিশ্চিত</span></p>
    </div>
    <div class="meta-box">
      <h4>📦 মোট পণ্য</h4>
      <p style="font-size:22px;color:#6610f2">${totalQuantity} <span style="font-size:13px;color:#6c757d">ইউনিট</span></p>
      <p style="font-size:11px;color:#6c757d">${(products.length > 0 ? products : [{ name: "পণ্য" }]).length} ধরনের পণ্য</p>
    </div>
    <div class="meta-box">
      <h4>📋 ACO পরিকল্পনা</h4>
      <p>ধাপ ${phase} · Phase ${phase}</p>
      <p style="margin-top:4px"><span class="badge badge-blue">🐜 ACO অপ্টিমাইজড রুট</span></p>
      <p style="font-size:11px;color:#6c757d;margin-top:4px">পিঁপড়া কলোনি অ্যালগরিদম দ্বারা সর্বোত্তম পথ নির্বাচিত</p>
    </div>
  </div>

  <h3 style="margin:0 0 10px;font-size:14px;color:#495057">📦 পণ্য তালিকা / Product Manifest</h3>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>পণ্যের নাম / Product</th>
        <th>পরিমাণ / Qty</th>
        <th>অবস্থা / Condition</th>
      </tr>
    </thead>
    <tbody>${productRows}</tbody>
    <tfoot>
      <tr style="background:#e9ecef;font-weight:700">
        <td colspan="2" style="padding:8px 12px;border:1px solid #dee2e6">মোট / Total</td>
        <td style="padding:8px 12px;border:1px solid #dee2e6;text-align:center">${totalQuantity}</td>
        <td style="padding:8px 12px;border:1px solid #dee2e6;text-align:center">—</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div>
      <p style="margin:0;font-weight:600">এই নথিটি UiPath RPA এজেন্ট দ্বারা স্বয়ংক্রিয়ভাবে তৈরি করা হয়েছে।</p>
      <p style="margin:4px 0 0">This document was auto-generated by the UiPath RPA Agent integrated with NodeCommerce ACO Pipeline.</p>
    </div>
    <div style="text-align:right">
      <div class="sig-box">প্রাপকের স্বাক্ষর<br>Receiver Signature</div>
    </div>
  </div>
</body>
</html>`;

    // Return as HTML blob — browser's print dialog saves as PDF
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="manifest-${shipmentId?.slice(0, 8) ?? "demo"}.html"`,
        "X-UiPath-Generated": "true",
      },
    });
  } catch (err: any) {
    console.error("[delivery-manifest]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
