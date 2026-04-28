import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.storage.*.nhost.run",
      },
      {
        protocol: "https",
        hostname: "xtcjayqveqspvckoiyek.storage.ap-south-1.nhost.run",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
