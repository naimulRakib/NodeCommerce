import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NodeCommerce — Shop Everything, Sell Anything",
    template: "%s | NodeCommerce",
  },
  description:
    "NodeCommerce is Bangladesh's fastest-growing online marketplace. Shop from thousands of verified local sellers with fast delivery and secure payments.",
  keywords: ["e-commerce", "bangladesh", "online shopping", "marketplace", "buy", "sell"],
  openGraph: {
    title: "NodeCommerce",
    description: "Shop from thousands of local sellers across Bangladesh.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased font-sans">{children}</body>
    </html>
  );
}
