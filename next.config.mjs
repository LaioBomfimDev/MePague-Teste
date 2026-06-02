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

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  async headers() {
    return [
      // Headers de segurança em TODAS as rotas
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Headers de cache nas rotas dinâmicas
      ...noStoreRoutes.map((source) => ({
        source,
        headers: noStoreHeaders,
      })),
    ];
  },
};

export default nextConfig;
