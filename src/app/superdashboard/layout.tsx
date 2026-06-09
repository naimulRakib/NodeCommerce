import React from "react";

export const metadata = {
  title: "SuperDashboard | NodeCommerce Bangladesh",
  description: "Real-time supply chain visualization of registered sellers, local, upazilla, and district resellers across Bangladesh.",
};

export default function SuperDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-900 m-0 p-0 text-slate-100 font-sans antialiased">
      {children}
    </div>
  );
}
