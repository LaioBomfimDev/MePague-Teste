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

function countMatches(source, pattern) {
  return Array.from(source.matchAll(pattern)).length;
}

const adminPage = readProjectFile(path.join("src", "app", "admin", "page.tsx"));
const adminUsersRoute = readProjectFile(path.join("src", "app", "api", "admin", "users", "route.ts"));
const auditLogsRoute = readProjectFile(path.join("src", "app", "api", "admin", "audit-logs", "route.ts"));
const globalStyles = readProjectFile(path.join("src", "app", "globals.css"));
const drawer = sliceBetween(adminPage, "function UserDetailContent({", "function AdminModal(");
const modal = sliceBetween(adminPage, "function AdminModal({", "function DetailLine(");

assert.match(adminPage, /const sensitiveAuditActions = new Set\(\[/, "Admin page must keep a sensitive audit action list for the drawer.");
assert.match(adminPage, /const emptyActivitySummary: AdminUserSummary\["activity"\]/, "Admin page must keep a safe activity fallback for stale admin user summaries.");
assert.match(adminPage, /function normalizeAdminUserSummary\(item: AdminUserSummary\): AdminUserSummary/, "Admin page must normalize admin user summaries before rendering details.");
assert.match(adminPage, /\.map\(normalizeAdminUserSummary\)/, "Admin data loading must apply the user summary normalizer.");
assert.match(adminPage, /function auditLogBelongsToUser\(log: AuditLog, userId: string\)/, "Admin page must map audit logs to the focused user.");
assert.match(adminPage, /function isAdminAuditLog\(log: AuditLog\)/, "Admin detail timeline must distinguish admin audit from product activity.");
assert.match(adminPage, /deletedUserId/, "Audit log matching must include hard-delete metadata.");
assert.match(
  adminPage,
  /const focusedUserAuditLogs = useMemo\(\(\) => \{[\s\S]*isAdminAuditLog\(log\) && auditLogBelongsToUser\(log, focusedUser\.id\)[\s\S]*\.slice\(0, 6\)/,
  "The drawer must receive a small recent admin audit list for the focused user.",
);
assert.match(adminPage, /auditLogs=\{focusedUserAuditLogs\}/, "Focused user audit logs must be passed into the detail drawer.");

assert.match(drawer, /auditLogs: AuditLog\[\]/, "User detail drawer must accept typed audit logs.");
assert.match(drawer, /Atividade do app/, "User detail drawer must render product activity summary.");
assert.match(drawer, /Sinal de uso/, "User detail drawer must show an engagement signal.");
assert.match(drawer, /activity\.usageLabel/, "User detail drawer must render the engagement label.");
assert.match(drawer, /activity\.usageDescription/, "User detail drawer must explain the engagement signal.");
assert.match(drawer, /Dividas cadastradas/, "User detail drawer must show non-financial debt count.");
assert.match(drawer, /Ultima acao do usuario/, "User detail drawer must show the user's latest product action.");
assert.match(drawer, /activity\.lastUserActionLabel/, "User detail drawer must render the latest product activity label.");
assert.match(drawer, /Historico administrativo recente/, "User detail drawer must render a recent admin history section.");
assert.match(drawer, /actionLabel\(log\.action\)/, "Timeline must show the audit action label.");
assert.match(drawer, /formatDateTime\(log\.createdAt\)/, "Timeline must show the audit date.");
assert.match(drawer, /log\.actorEmail \|\| "Sistema"/, "Timeline must show the actor fallback.");
assert.match(drawer, /const reason = auditReason\(log\)/, "Timeline must pull the reason when available.");
assert.match(drawer, /isSensitiveAuditAction\(log\.action\)/, "Timeline must flag sensitive audit actions.");

assert.match(
  adminPage,
  /function openDetail\(userId: string\) \{[\s\S]*setFocusedUserId\(userId\);[\s\S]*setDetailOpen\(true\);[\s\S]*\}/,
  "Opening user detail must select the user and open the modal.",
);
assert.ok(
  countMatches(adminPage, /onClick=\{\(\) => openDetail\(item\.id\)\}/g) >= 2,
  "Mobile user cards must keep touch targets that open the detail modal.",
);
assert.match(adminPage, /<Eye size=\{14\} \/> Detalhes/, "User cards must expose a Detalhes button for the interaction smoke.");
assert.match(
  adminPage,
  /\{focusedUser && detailOpen && \([\s\S]*<AdminModal title="Detalhe do usuario" size="lg"/,
  "The user detail modal must be gated by detailOpen and use the large drawer size.",
);
assert.match(adminPage, /import \{ createPortal \} from "react-dom";/, "Admin modals must portal out of page stacking contexts.");
assert.match(modal, /return createPortal\(/, "Admin modal content must be rendered through a portal.");
assert.match(modal, /document\.body/, "Admin modal portal must target the document body.");
assert.match(modal, /const sizeClass = size === "lg" \? "max-w-3xl" : "max-w-lg";/, "Large admin modals must keep their responsive max width.");
assert.match(modal, /className="app-modal__backdrop z-0"/, "Admin modal backdrop must remain behind the panel.");
assert.match(modal, /className=\{`app-modal__panel relative z-10 w-full \$\{sizeClass\}/, "Admin modal panel must remain full-width on mobile and above the backdrop.");
assert.match(globalStyles, /\.app-modal \{[\s\S]*align-items: flex-end;/, "Mobile modal should open from the bottom edge.");
assert.match(globalStyles, /\.app-modal \{[\s\S]*overflow-y: auto;/, "Mobile modal overlay must allow vertical scroll.");
assert.match(globalStyles, /\.app-modal__panel \{[\s\S]*max-height: calc\(100dvh - 2rem\);/, "Mobile modal panel must fit within the viewport height.");
assert.match(globalStyles, /\.app-modal__panel \{[\s\S]*-webkit-overflow-scrolling: touch;/, "Mobile modal panel must keep touch scrolling.");
assert.match(globalStyles, /@media \(min-width: 640px\) \{[\s\S]*\.app-modal \{[\s\S]*align-items: center;/, "Desktop modal centering must remain scoped away from mobile.");

assert.match(adminUsersRoute, /type DebtActivityRow = \{[\s\S]*user_id: string;[\s\S]*status\?: string \| null;[\s\S]*\}/, "Admin user summaries must type non-financial debt activity rows.");
assert.match(adminUsersRoute, /\.from\("debts"\)\.select\("user_id,status,created_at,updated_at"\)/, "Admin user summaries must only select non-financial debt fields.");
assert.doesNotMatch(adminUsersRoute, /\.from\("debts"\)\.select\("[^"]*amount/, "Admin user summaries must not select debt amounts.");
assert.match(adminUsersRoute, /lastUserActionLabel: "Sem acao registrada"/, "Admin user activity must have a clear empty state.");
assert.match(adminUsersRoute, /function applyUsageSignal\(/, "Admin user summaries must classify whether the user is really using the app.");
assert.match(adminUsersRoute, /usageLabel = "So fez login"/, "Engagement signal must identify login-only users.");
assert.match(adminUsersRoute, /usageLabel = "Testou pouco"/, "Engagement signal must identify light trial usage.");
assert.match(adminUsersRoute, /usageLabel = "Usando de verdade"/, "Engagement signal must identify real product usage.");
assert.match(adminUsersRoute, /usageLabel = "Usou, mas parou"/, "Engagement signal must identify stale product usage.");
assert.match(adminUsersRoute, /activity: activityWithUsage,/, "Admin user summary payload must include classified activity.");

assert.match(auditLogsRoute, /function sanitizeAuditData\(data\?: Record<string, unknown> \| null\)/, "Admin audit API must sanitize row snapshots before sending them to the client.");
assert.match(auditLogsRoute, /visibleAuditFields/, "Admin audit API must keep an explicit allowlist of visible row fields.");
assert.match(auditLogsRoute, /oldData: sanitizeAuditData\(row\.old_data\)/, "Admin audit API must sanitize old row snapshots.");
assert.match(auditLogsRoute, /newData: sanitizeAuditData\(row\.new_data\)/, "Admin audit API must sanitize new row snapshots.");

console.log("Admin detail timeline and mobile modal checks passed.");
