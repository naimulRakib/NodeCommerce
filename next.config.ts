import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,

  experimental: {
    optimizePackageImports: [
      'leaflet',
      'react-leaflet',
      'react-leaflet-cluster',
      'qrcode.react',
      'lucide-react',
      '@radix-ui/react-dialog',
      'recharts'
    ]
  },
  typescript: { ignoreBuildErrors: true },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "nodecommerce",
  project: "nodecommerce",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/




  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // tunnelRoute: "/monitoring",




  // Enables automatic instrumentation of Vercel Cron Monitors.
  // automaticVercelMonitors: true,
});
