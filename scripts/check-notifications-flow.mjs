import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

function readProjectFile(filePath) {
  return readFileSync(path.join(process.cwd(), filePath), "utf8");
}

const dashboard = readProjectFile(path.join("src", "app", "page.tsx"));
const subscriptionsRoute = readProjectFile(path.join("src", "app", "api", "notifications", "subscriptions", "route.ts"));
const schema = readProjectFile("supabase-schema.sql");
const notificationsMigration = readProjectFile("supabase-notifications-migration.sql");

const notificationModalStart = dashboard.indexOf("function NotificationPermissionModal");
assert.notEqual(notificationModalStart, -1, "Dashboard must render notification permission as a modal.");
const notificationModal = dashboard.slice(notificationModalStart);

assert.match(notificationModal, /createPortal|app-modal/, "Notification prompt must use the app modal surface.");
assert.match(notificationModal, /role="dialog"/, "Notification prompt must expose a dialog role.");
assert.match(notificationModal, /aria-modal="true"/, "Notification prompt must be announced as modal.");
assert.match(notificationModal, /Receber avisos (as|às) 8h\?/, "Notification prompt copy must still be present.");

assert.match(subscriptionsRoute, /timezone:\s*"America\/Sao_Paulo"/, "Subscription response must include timezone.");
assert.doesNotMatch(schema, /changed_record_id := (old|new)\.id::text;/, "Audit trigger must not assume every table has id.");
assert.match(schema, /coalesce\(to_jsonb\(new\)->>'id', to_jsonb\(new\)->>'user_id'\)/, "Audit trigger must support notification_preferences.");
assert.match(notificationsMigration, /create or replace function public\.audit_row_change\(\)/, "Notifications migration must repair the audit trigger.");
assert.match(notificationsMigration, /coalesce\(to_jsonb\(new\)->>'id', to_jsonb\(new\)->>'user_id'\)/, "Notifications migration must support notification_preferences.");

console.log("Notification flow checks passed.");
