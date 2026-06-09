import type { NextConfig } from "next";

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

export default nextConfig;

