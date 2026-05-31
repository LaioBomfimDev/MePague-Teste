import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const sourcePath = path.join(process.cwd(), "src", "lib", "debtPresentation.ts");
const source = readFileSync(sourcePath, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: sourcePath,
});
const sandbox = {
  exports: {},
  module: { exports: {} },
};
sandbox.exports = sandbox.module.exports;

vm.runInNewContext(outputText, sandbox, { filename: sourcePath });

const { getDebtCardActions, getOpenDebtSummary } = sandbox.module.exports;

function assertJsonEqual(actual, expected) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
}

assertJsonEqual(getDebtCardActions("open"), ["pay", "edit", "delete", "charge"]);
assertJsonEqual(getDebtCardActions("paid"), ["reopen", "delete"]);
assertJsonEqual(getOpenDebtSummary(0, 0), { label: "Tudo pago", tone: "success" });
assertJsonEqual(getOpenDebtSummary(1, 0), { label: "1 aberta", tone: "info" });
assertJsonEqual(getOpenDebtSummary(3, 0), { label: "3 abertas", tone: "info" });
assertJsonEqual(getOpenDebtSummary(2, 1), { label: "1 atrasada", tone: "danger" });
assertJsonEqual(getOpenDebtSummary(5, 2), { label: "2 atrasadas", tone: "danger" });

console.log("Debt presentation checks passed.");
