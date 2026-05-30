import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
      }),
  );
}

const env = {
  ...readEnvFile(path.join(process.cwd(), ".env.local")),
  ...process.env,
};

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const email = env.SUPERADMIN_EMAIL || env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "superadm@mepague.app";
const password = env.SUPERADMIN_PASSWORD || "654321";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local antes de rodar.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findUserByEmail(targetEmail) {
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) throw error;

    const found = (data.users || []).find((user) => user.email?.toLowerCase() === targetEmail.toLowerCase());

    if (found || (data.users || []).length < 1000) return found || null;

    page += 1;
  }
}

const existingUser = await findUserByEmail(email);
const userResult = existingUser
  ? await admin.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(existingUser.user_metadata || {}), name: "superadm" },
    })
  : await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: "superadm" },
    });

if (userResult.error) {
  throw userResult.error;
}

const user = userResult.data.user;

if (!user) {
  throw new Error("Supabase nao retornou o usuario superadm.");
}

const { error: profileError } = await admin.from("profiles").upsert(
  {
    id: user.id,
    name: "superadm",
    email,
    pix_key: "",
    plan: "pro",
    role: "superadmin",
    status: "active",
    updated_at: new Date().toISOString(),
  },
  { onConflict: "id" },
);

if (profileError) {
  throw profileError;
}

await admin.from("audit_logs").insert({
  actor_id: user.id,
  actor_email: email,
  target_user_id: user.id,
  action: existingUser ? "admin.superadmin_updated" : "admin.superadmin_created",
  table_name: "admin",
  metadata: { source: "bootstrap-superadmin" },
});

console.log(`Superadm pronto: ${email}`);
console.log("Login rapido no app: superadm");
