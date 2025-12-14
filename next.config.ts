import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    unoptimized: true,
  },
  // Onemogući ESLint greške u build procesu (privremeno)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Onemogući TypeScript greške u build procesu (privremeno)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Increase build timeout
  staticPageGenerationTimeout: 120,
  // Optimize build - reduce memory usage
  experimental: {
    optimizePackageImports: ['chart.js', 'react-chartjs-2'],
  },
};

export default nextConfig;
