/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // 75 is the default; 50 serves the landing hero's photo wall, which sits under a dark shade;
    // 90 keeps the sign-in photo crisp.
    qualities: [50, 75, 90],
  },
};

export default nextConfig;
