import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PLAN §0: Cache Components stays off — it cannot be combined with
  // `export const dynamic = 'force-dynamic'`, which DB-reading pages rely on.
  cacheComponents: false,
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
