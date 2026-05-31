/** @type {import('next').NextConfig} */
const noStoreHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, max-age=0, must-revalidate",
  },
  {
    key: "Pragma",
    value: "no-cache",
  },
];

const noStoreRoutes = [
  "/",
  "/login",
  "/debtors",
  "/debtors/:path*",
  "/reports",
  "/profile",
  "/new-debt",
  "/admin",
  "/admin/:path*",
  "/manifest.json",
  "/sw.js",
];

const nextConfig = {
  async headers() {
    return noStoreRoutes.map((source) => ({
      source,
      headers: noStoreHeaders,
    }));
  },
};

export default nextConfig;
