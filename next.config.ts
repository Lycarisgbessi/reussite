import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Binaires natifs / gros modules côté serveur uniquement
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
