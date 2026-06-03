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
const email = env.SUPERADMIN_EMAIL || env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "laiolindowow10@gmail.com";
const adminName = env.SUPERADMIN_NAME || email;
const password = env.SUPERADMIN_PASSWORD || "654321";
const legacyEmail = env.LEGACY_SUPERADMIN_EMAIL || "superadm@mepague.app";

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

function sameEmail(left, right) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

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
const legacyUser = !sameEmail(email, legacyEmail) ? await findUserByEmail(legacyEmail) : null;
const userToUpdate = existingUser || legacyUser;
const userResult = userToUpdate
  ? await admin.auth.admin.updateUserById(userToUpdate.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: { ...(userToUpdate.user_metadata || {}), name: adminName },
    })
  : await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: adminName },
    });

if (userResult.error) {
  throw userResult.error;
}

const user = userResult.data.user;
const now = new Date().toISOString();

if (!user) {
  throw new Error("Supabase nao retornou o usuario administrador.");
}

const { error: profileError } = await admin.from("profiles").upsert(
  {
    id: user.id,
    name: adminName,
    email,
    pix_key: "",
    plan: "pro",
    role: "superadmin",
    status: "active",
    status_reason: "",
    status_changed_at: now,
    status_changed_by: null,
    deleted_at: null,
    updated_at: now,
  },
  { onConflict: "id" },
);

if (profileError) {
  throw profileError;
}

if (legacyUser && legacyUser.id !== user.id) {
  const { error: deleteLegacyProfileError } = await admin.from("profiles").delete().eq("id", legacyUser.id);

  if (deleteLegacyProfileError) {
    throw deleteLegacyProfileError;
  }

  const { error: deleteLegacyAuthError } = await admin.auth.admin.deleteUser(legacyUser.id, false);

  if (deleteLegacyAuthError) {
    throw deleteLegacyAuthError;
  }
}

const { error: staleLegacyProfileError } = await admin
  .from("profiles")
  .delete()
  .eq("email", legacyEmail)
  .neq("id", user.id);

if (staleLegacyProfileError) {
  throw staleLegacyProfileError;
}

const { error: extraAdminError } = await admin
  .from("profiles")
  .update({
    role: "user",
    status: "inactive",
    status_reason: "Administrador removido para manter apenas uma conta admin",
    status_changed_at: now,
    status_changed_by: user.id,
    updated_at: now,
  })
  .in("role", ["admin", "superadmin"])
  .neq("id", user.id);

if (extraAdminError) {
  throw extraAdminError;
}

await admin.from("audit_logs").insert({
  actor_id: user.id,
  actor_email: email,
  target_user_id: user.id,
  action: userToUpdate ? "admin.superadmin_updated" : "admin.superadmin_created",
  table_name: "admin",
  metadata: { source: "bootstrap-superadmin", migratedFrom: legacyUser?.email || null },
});

console.log(`Superadm pronto: ${email}`);
console.log(`Login no app: ${email}`);
