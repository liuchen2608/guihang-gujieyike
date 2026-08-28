import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
  webpack(config) {
    config.module.rules.push({ test: /\.md$/, resourceQuery: /raw/, type: 'asset/source' });
    return config;
  },
};

export default nextConfig;
