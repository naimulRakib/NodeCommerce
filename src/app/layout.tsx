import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/layout/ToastProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PageLayout } from "@/components/layout/PageLayout";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
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
    <html lang="bn" data-theme="light" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <LanguageProvider>
          <ToastProvider>
            <PageLayout>
              {children}
            </PageLayout>
            <MobileBottomNav />
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
