/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // 75 is the default; 50 serves the landing hero's photo wall, which sits under a dark shade;
    // 90 keeps the sign-in photo crisp.
    qualities: [50, 75, 90],
  },
  async redirects() {
    return [
      // The public dashboard is now the Dashboard view of Map & Dashboard. The query
      // string (?region=) is passed through, so /projects/dashboard?region=X lands on
      // /projects/map?view=dashboard&region=X.
      { source: '/projects/dashboard', destination: '/projects/map?view=dashboard', permanent: true },
    ];
  },
};

export default nextConfig;
