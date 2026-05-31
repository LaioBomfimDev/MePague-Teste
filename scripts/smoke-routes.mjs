const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const requiredRoutes = [
  "/",
  "/login",
  "/debtors",
  "/new-debt",
  "/profile",
  "/reports",
  "/admin",
  "/manifest.json",
  "/sw.js",
  "/favicon.ico",
];
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 10000);

function resolveUrl(path) {
  return new URL(path, baseUrl).toString();
}

async function fetchWithTimeout(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(resolveUrl(path), {
      redirect: "follow",
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function assertOk(path) {
  const response = await fetchWithTimeout(path);

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  console.log(`OK ${response.status} ${path}`);
  return response;
}

async function main() {
  console.log(`Smoke target: ${baseUrl}`);

  for (const route of requiredRoutes) {
    await assertOk(route);
  }

  const manifestResponse = await fetchWithTimeout("/manifest.json");
  const manifest = await manifestResponse.json();
  const iconPaths = (manifest.icons || []).map((icon) => icon.src).filter(Boolean);

  if (iconPaths.length === 0) {
    throw new Error("manifest.json has no icons");
  }

  for (const iconPath of iconPaths) {
    await assertOk(iconPath);
  }
  console.log("Smoke routes passed.");
}

main().catch((error) => {
  console.error(`Smoke routes failed: ${error.message}`);
  process.exit(1);
});
