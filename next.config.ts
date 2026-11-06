import type { NextConfig } from "next";

// Cache Components is intentionally off: every API route opts out of caching
// with `export const dynamic = "force-dynamic"` and explicit Cache-Control headers.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
