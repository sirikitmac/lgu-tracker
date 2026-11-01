/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // 75 is the default; 50 serves the landing hero's photo wall, which sits under a dark shade.
    qualities: [50, 75],
  },
};

export default nextConfig;
