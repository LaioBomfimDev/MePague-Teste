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
const globalStyles = readProjectFile(path.join("src", "app", "globals.css"));
const drawer = sliceBetween(adminPage, "function UserDetailContent({", "function AdminModal(");
const modal = sliceBetween(adminPage, "function AdminModal({", "function DetailLine(");

assert.match(adminPage, /const sensitiveAuditActions = new Set\(\[/, "Admin page must keep a sensitive audit action list for the drawer.");
assert.match(adminPage, /function auditLogBelongsToUser\(log: AuditLog, userId: string\)/, "Admin page must map audit logs to the focused user.");
assert.match(adminPage, /deletedUserId/, "Audit log matching must include hard-delete metadata.");
assert.match(
  adminPage,
  /const focusedUserAuditLogs = useMemo\(\(\) => \{[\s\S]*auditLogBelongsToUser\(log, focusedUser\.id\)[\s\S]*\.slice\(0, 6\)/,
  "The drawer must receive a small recent audit list for the focused user.",
);
assert.match(adminPage, /auditLogs=\{focusedUserAuditLogs\}/, "Focused user audit logs must be passed into the detail drawer.");

assert.match(drawer, /auditLogs: AuditLog\[\]/, "User detail drawer must accept typed audit logs.");
assert.match(drawer, /Historico recente/, "User detail drawer must render a recent history section.");
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
assert.match(
  adminPage,
  /\{focusedUser && detailOpen && \([\s\S]*<AdminModal title="Detalhe do usuario" size="lg"/,
  "The user detail modal must be gated by detailOpen and use the large drawer size.",
);
assert.match(modal, /const sizeClass = size === "lg" \? "max-w-3xl" : "max-w-lg";/, "Large admin modals must keep their responsive max width.");
assert.match(modal, /className=\{`app-modal__panel relative w-full \$\{sizeClass\}/, "Admin modal panel must remain full-width on mobile.");
assert.match(globalStyles, /\.app-modal \{[\s\S]*align-items: flex-end;/, "Mobile modal should open from the bottom edge.");
assert.match(globalStyles, /\.app-modal \{[\s\S]*overflow-y: auto;/, "Mobile modal overlay must allow vertical scroll.");
assert.match(globalStyles, /\.app-modal__panel \{[\s\S]*max-height: calc\(100dvh - 2rem\);/, "Mobile modal panel must fit within the viewport height.");
assert.match(globalStyles, /\.app-modal__panel \{[\s\S]*-webkit-overflow-scrolling: touch;/, "Mobile modal panel must keep touch scrolling.");
assert.match(globalStyles, /@media \(min-width: 640px\) \{[\s\S]*\.app-modal \{[\s\S]*align-items: center;/, "Desktop modal centering must remain scoped away from mobile.");

console.log("Admin detail timeline and mobile modal checks passed.");
