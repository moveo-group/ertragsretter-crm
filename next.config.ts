import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Fotos werden über Server Actions hochgeladen
    serverActions: { bodySizeLimit: '15mb' },
  },
};

export default nextConfig;
