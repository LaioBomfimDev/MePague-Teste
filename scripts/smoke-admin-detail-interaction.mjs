import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3033";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);
const demoSessionKey = "me-pague:demo-session";
const demoStoreKey = "me-pague:demo-store";
const supabaseSessionKey = "me-pague:supabase-auth-v2";
const demoUserId = "demo-admlaio";
const smokeUserId = "smoke-superadmin";
const now = new Date().toISOString();

function resolveUrl(path) {
  return new URL(path, baseUrl).toString();
}

async function launchBrowser() {
  const requestedChannel = process.env.SMOKE_BROWSER_CHANNEL;
  const candidates = requestedChannel
    ? [{ channel: requestedChannel, label: requestedChannel }]
    : [
        { channel: "chrome", label: "chrome" },
        { channel: "msedge", label: "msedge" },
        { label: "playwright chromium" },
      ];
  const errors = [];

  for (const candidate of candidates) {
    try {
      return await chromium.launch({
        channel: candidate.channel,
        headless: true,
      });
    } catch (error) {
      errors.push(`${candidate.label}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }

  throw new Error(
    `Nao foi possivel iniciar um navegador para o smoke. Rode "npx playwright install chromium" ou defina SMOKE_BROWSER_CHANNEL. Tentativas: ${errors.join(" | ")}`,
  );
}

const demoStore = {
  chargeLogs: [],
  customers: [],
  debts: [],
  payments: [],
  profile: {
    adminNotes: "",
    createdAt: now,
    email: "smoke-superadmin@mepague.test",
    id: demoUserId,
    name: "Smoke Superadmin",
    pixKey: "smoke@pix",
    plan: "pro",
    role: "superadmin",
    status: "active",
    statusReason: "",
    updatedAt: now,
  },
};

const supabaseSession = {
  access_token: "smoke-access-token",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  refresh_token: "smoke-refresh-token",
  token_type: "bearer",
  user: {
    app_metadata: {},
    aud: "authenticated",
    created_at: now,
    email: "smoke-superadmin@mepague.test",
    id: demoUserId,
    role: "authenticated",
    user_metadata: { name: "Smoke Superadmin" },
  },
};

const usersPayload = {
  schemaReady: true,
  users: [
    {
      adminNotes: "Conta usada para validar o drawer de detalhes.",
      authCreatedAt: now,
      createdAt: now,
      daysSinceCreated: 0,
      daysSinceLastSignIn: 0,
      deletedAt: null,
      email: "smoke-superadmin@mepague.test",
      emailConfirmedAt: now,
      id: smokeUserId,
      lastSignInAt: now,
      name: "Smoke Superadmin",
      plan: "pro",
      recentSensitiveActionAt: null,
      riskLevel: "high",
      riskScore: 25,
      riskTags: ["Acesso maximo"],
      role: "superadmin",
      status: "active",
      statusChangedAt: null,
      statusChangedBy: null,
      statusReason: "",
      updatedAt: now,
    },
  ],
};

const auditLogsPayload = {
  logs: [
    {
      action: "admin.superadmin_updated",
      actorEmail: "smoke-superadmin@mepague.test",
      actorId: demoUserId,
      createdAt: now,
      id: "smoke-admin-audit",
      metadata: { reason: "Smoke de detalhes do superadmin" },
      newData: null,
      oldData: null,
      recordId: null,
      tableName: "admin",
      targetUserId: smokeUserId,
    },
  ],
};

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { height: 844, width: 390 },
});
const page = await context.newPage();
const pageErrors = [];

page.on("pageerror", (error) => {
  pageErrors.push(error.message);
});

await page.addInitScript(
  ({ auditLogsPayload, demoSessionKey, demoStore, demoStoreKey, supabaseSession, supabaseSessionKey, usersPayload }) => {
    window.localStorage.setItem(demoSessionKey, "true");
    window.localStorage.setItem(demoStoreKey, JSON.stringify(demoStore));
    window.localStorage.setItem(supabaseSessionKey, JSON.stringify(supabaseSession));

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const rawUrl = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      const url = new URL(rawUrl, window.location.origin);

      if (url.pathname === "/api/admin/users") {
        return new Response(JSON.stringify(usersPayload), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      if (url.pathname === "/api/admin/audit-logs") {
        return new Response(JSON.stringify(auditLogsPayload), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      return originalFetch(input, init);
    };
  },
  { auditLogsPayload, demoSessionKey, demoStore, demoStoreKey, supabaseSession, supabaseSessionKey, usersPayload },
);

try {
  await page.goto(resolveUrl("/admin"), { timeout: timeoutMs, waitUntil: "domcontentloaded" });

  await page.getByRole("heading", { name: "Governanca" }).waitFor({ state: "visible", timeout: timeoutMs });
  await page.getByRole("button", { exact: true, name: "Detalhes" }).click({ timeout: timeoutMs });

  const backdrop = page.locator(".app-modal__backdrop").first();
  const panel = page.locator(".app-modal__panel").first();
  const dialog = page.getByRole("dialog", { name: "Detalhe do usuario" });

  await backdrop.waitFor({ state: "attached", timeout: timeoutMs });
  await panel.waitFor({ state: "visible", timeout: timeoutMs });
  await dialog.waitFor({ state: "visible", timeout: timeoutMs });
  await dialog.getByText("Smoke Superadmin", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  await dialog.getByText("Atividade do app", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  await dialog.getByText("Historico administrativo recente", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  await dialog.getByText("Nunca entrou", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });

  const panelBox = await panel.boundingBox();

  assert.ok(panelBox, "Admin detail smoke found the backdrop, but no drawer panel box.");
  assert.ok(panelBox.width > 250, `Admin detail drawer panel is too narrow: ${panelBox.width}`);
  assert.ok(panelBox.height > 250, `Admin detail drawer panel is too short: ${panelBox.height}`);
  assert.deepEqual(pageErrors, [], `Page errors while opening admin detail drawer: ${pageErrors.join(" | ")}`);

  console.log("Admin detail interaction smoke passed.");
} finally {
  await browser.close();
}
