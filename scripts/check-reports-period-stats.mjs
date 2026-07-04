import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const reportsPagePath = path.join(process.cwd(), "src", "app", "reports", "page.tsx");
const source = readFileSync(reportsPagePath, "utf8");

assert.match(
  source,
  /label="Previsto 7 dias"[\s\S]*value=\{formatCurrency\(reportStats\.forecast7Days\)\}/,
  "The 7-day forecast card must use the selected period stats.",
);
assert.match(
  source,
  /label="Previsto 30 dias"[\s\S]*value=\{formatCurrency\(reportStats\.forecast30Days\)\}/,
  "The 30-day forecast card must use the selected period stats.",
);
assert.doesNotMatch(
  source,
  /label="Previsto 7 dias"[\s\S]*value=\{formatCurrency\(stats\.forecast7Days\)\}/,
  "The 7-day forecast card must not use global stats when a period is selected.",
);
assert.doesNotMatch(
  source,
  /label="Previsto 30 dias"[\s\S]*value=\{formatCurrency\(stats\.forecast30Days\)\}/,
  "The 30-day forecast card must not use global stats when a period is selected.",
);

console.log("Report period stat checks passed.");
