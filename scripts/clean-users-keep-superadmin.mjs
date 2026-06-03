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
const keepEmail = (env.KEEP_SUPERADMIN_EMAIL || env.SUPERADMIN_EMAIL || env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "laiolindowow10@gmail.com")
  .trim()
  .toLowerCase();
const adminName = env.SUPERADMIN_NAME || keepEmail;
const fallbackPassword = env.SUPERADMIN_PASSWORD || "654321";

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

async function listAuthUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) throw error;

    users.push(...(data.users || []));

    if ((data.users || []).length < 1000) break;
    page += 1;
  }

  return users;
}

async function findUserByEmail(email) {
  const users = await listAuthUsers();
  return users.find((user) => user.email?.toLowerCase() === email) || null;
}

async function deletePublicUserData(userId) {
  const userScopedTables = [
    "notification_deliveries",
    "push_subscriptions",
    "notification_preferences",
    "charge_logs",
    "payments",
    "debts",
    "customers",
  ];

  for (const table of userScopedTables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);

    if (error) throw error;
  }

  const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);

  if (profileError) throw profileError;
}

const existingAdmin = await findUserByEmail(keepEmail);
const adminResult = existingAdmin
  ? await admin.auth.admin.updateUserById(existingAdmin.id, {
      email_confirm: true,
      user_metadata: { ...(existingAdmin.user_metadata || {}), name: adminName },
    })
  : await admin.auth.admin.createUser({
      email: keepEmail,
      password: fallbackPassword,
      email_confirm: true,
      user_metadata: { name: adminName },
    });

if (adminResult.error) throw adminResult.error;
if (!adminResult.data.user) throw new Error("Supabase nao retornou o usuario administrador.");

const keptUser = adminResult.data.user;
const now = new Date().toISOString();

const { error: profileError } = await admin.from("profiles").upsert(
  {
    id: keptUser.id,
    name: adminName,
    email: keepEmail,
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

if (profileError) throw profileError;

const authUsers = await listAuthUsers();
const usersToDelete = authUsers.filter((user) => user.id !== keptUser.id);

for (const user of usersToDelete) {
  await deletePublicUserData(user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id, false);

  if (error) throw error;
}

const { data: staleProfiles, error: staleProfilesLoadError } = await admin
  .from("profiles")
  .select("id,email")
  .neq("id", keptUser.id);

if (staleProfilesLoadError) throw staleProfilesLoadError;

const { error: staleProfilesDeleteError } = await admin.from("profiles").delete().neq("id", keptUser.id);

if (staleProfilesDeleteError) throw staleProfilesDeleteError;

const { error: auditError } = await admin.from("audit_logs").insert({
  actor_id: keptUser.id,
  actor_email: keepEmail,
  target_user_id: keptUser.id,
  action: "admin.database_users_cleaned",
  table_name: "admin",
  metadata: {
    deletedAuthUsers: usersToDelete.map((user) => ({ email: user.email || "", id: user.id })),
    deletedProfileRows: (staleProfiles || []).map((profile) => ({ email: profile.email || "", id: profile.id })),
    keptUserEmail: keepEmail,
    keptUserId: keptUser.id,
    source: "clean-users-keep-superadmin",
  },
});

if (auditError) throw auditError;

console.log(`Superadm mantido: ${keepEmail}`);
console.log(`Usuarios Auth excluidos definitivamente: ${usersToDelete.length}`);
console.log(`Perfis orfaos/remanescentes excluidos: ${(staleProfiles || []).length}`);
console.log(existingAdmin ? "Senha do superadm existente nao foi alterada." : `Superadm criado com senha temporaria: ${fallbackPassword}`);
