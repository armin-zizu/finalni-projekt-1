import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Za Vercel deploy - nema static export
  images: {
    unoptimized: false, // Vercel automatski optimizuje slike
  },
  // Onemogući ESLint greške u build procesu (privremeno)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Onemogući TypeScript greške u build procesu (privremeno)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
