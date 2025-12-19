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
  // Eksplicitno postavi root direktorij za output file tracing
  // Ovo osigurava da Next.js koristi pravi root projekta umjesto da inferira iz lockfile-a
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
