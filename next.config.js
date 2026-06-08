/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: new URL(process.env.NEXT_PUBLIC_CDN_URL || 'https://placeholder.com').hostname,
      },
    ],
  },
};

export default nextConfig;
