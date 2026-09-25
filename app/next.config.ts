import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Catalog images come straight from the pokemontcg.io CDN.
    remotePatterns: [new URL("https://images.pokemontcg.io/**")],
  },
};

export default nextConfig;
