import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

function readProjectFile(filePath) {
  return readFileSync(path.join(process.cwd(), filePath), "utf8");
}

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing block start: ${start}`);

  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Missing block end: ${end}`);

  return source.slice(startIndex, endIndex);
}

const schema = readProjectFile("supabase-schema.sql");
const database = readProjectFile(path.join("src", "lib", "database.ts"));
const authProvider = readProjectFile(path.join("src", "components", "AuthProvider.tsx"));
const authProfileRoute = readProjectFile(path.join("src", "app", "api", "auth", "profile", "route.ts"));
const loginPage = readProjectFile(path.join("src", "app", "login", "page.tsx"));
const migration = readProjectFile("supabase-auto-approval-migration.sql");

const handleNewUser = sliceBetween(schema, "create or replace function public.handle_new_user()", "drop trigger if exists on_auth_user_created");
assert.match(handleNewUser, /'active'/, "New auth users must receive an active profile.");
assert.doesNotMatch(handleNewUser, /'pending'/, "New auth users should not depend on superadmin approval.");

const protectInsert = sliceBetween(schema, "if tg_op = 'INSERT' and auth.uid() = new.id then", "end if;");
assert.match(protectInsert, /new\.status := 'active';/, "User-created profiles must be forced to active.");
assert.doesNotMatch(protectInsert, /new\.status := 'pending';/, "User-created profiles must not be forced to pending.");

assert.match(
  schema,
  /with check \(auth\.uid\(\) = id and plan = 'free' and role = 'user' and status = 'active'\);/,
  "RLS insert policy must allow the active self-service profile.",
);
assert.match(database, /status:\s*"active",\s*[\r\n]+\s*updated_at:/, "Client profile upsert must create active profiles.");
assert.match(database, /row\.status === "pending" && role === "user" \? "active"/, "Legacy pending self-service profiles must be treated as active in the app.");
assert.match(authProvider, /\/api\/auth\/profile/, "Login sessions must ask the server to create or auto-activate the profile.");
assert.match(authProfileRoute, /status:\s*"active"/, "Server auth profile sync must create active profiles.");
assert.match(authProfileRoute, /\.eq\("role", "user"\)[\s\S]*\.eq\("status", "pending"\)/, "Server auth profile sync must activate pending regular users.");
assert.match(authProvider, /return \{ signedIn: true \};/, "Registration should keep an active session when Supabase returns one.");
assert.doesNotMatch(`${authProvider}\n${loginPage}`, /aguarde a aprovacao do superadm/i, "Signup copy should not ask users to wait for superadmin approval.");
assert.match(migration, /create trigger on_auth_user_created/, "Migration must recreate the auth user trigger.");
assert.match(migration, /where status = 'pending'[\s\S]*role = 'user'/, "Migration must activate existing regular pending users.");

console.log("Auth registration flow checks passed.");
