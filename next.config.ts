import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Habilita el binding de Cloudflare/D1 dentro de `next dev`.
initOpenNextCloudflareForDev({
  configPath: './wrangler.jsonc',
  remoteBindings: false,
  persist: { path: '.wrangler/state/v3' },
});

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    proxyClientMaxBodySize: '50mb',
  },
};

export default nextConfig;
