import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["indirectly-ligulate-vilma.ngrok-free.dev"],
  output: "standalone",
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
