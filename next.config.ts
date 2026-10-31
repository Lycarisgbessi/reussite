import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Binaires natifs / gros modules côté serveur uniquement
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  // Le « fake worker » Node de pdf.js est importé au runtime par
  // chemin absolu : il doit exister dans le bundle standalone.
  outputFileTracingIncludes: {
    "/api/admin/**": ["./node_modules/pdfjs-dist/legacy/build/**"],
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
