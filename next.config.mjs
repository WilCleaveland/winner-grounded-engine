/** @type {import('next').NextConfig} */
const nextConfig = {
  // Screenshots can be a few MB; allow generous server action / route bodies.
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
};

export default nextConfig;
