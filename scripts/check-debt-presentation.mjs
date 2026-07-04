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

const { getDebtCardActions, getNextChargeAction, getOpenDebtSummary } = sandbox.module.exports;

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

assertJsonEqual(
  getNextChargeAction({
    dueSoonCount: 0,
    dueTodayCount: 0,
    maxDaysOverdue: 0,
    openCount: 0,
    overdueCount: 0,
    today: new Date("2026-07-04T12:00:00"),
  }),
  {
    actionLabel: "Acompanhar",
    detail: "Nenhuma cobrança em aberto agora.",
    label: "Tudo pago",
    shouldCharge: false,
    tone: "success",
  },
);
assertJsonEqual(
  getNextChargeAction({
    dueSoonCount: 0,
    dueTodayCount: 0,
    lastChargedAt: "2026-07-04T08:30:00.000Z",
    maxDaysOverdue: 4,
    openCount: 1,
    overdueCount: 1,
    today: new Date("2026-07-04T12:00:00"),
  }),
  {
    actionLabel: "Acompanhar",
    detail: "A última cobrança foi registrada hoje.",
    label: "Aguardar retorno",
    shouldCharge: false,
    tone: "info",
  },
);
assertJsonEqual(
  getNextChargeAction({
    dueSoonCount: 0,
    dueTodayCount: 0,
    lastChargedAt: "2026-07-02T08:30:00.000Z",
    maxDaysOverdue: 4,
    openCount: 2,
    overdueCount: 2,
    today: new Date("2026-07-04T12:00:00"),
  }),
  {
    actionLabel: "Cobrar",
    detail: "2 cobranças até 4 dias de atraso.",
    label: "Cobrar atraso agora",
    shouldCharge: true,
    tone: "danger",
  },
);
assertJsonEqual(
  getNextChargeAction({
    dueSoonCount: 0,
    dueTodayCount: 1,
    maxDaysOverdue: 0,
    openCount: 1,
    overdueCount: 0,
    today: new Date("2026-07-04T12:00:00"),
  }),
  {
    actionLabel: "Lembrar",
    detail: "1 cobrança vence hoje.",
    label: "Lembrar vencimento hoje",
    shouldCharge: true,
    tone: "warning",
  },
);

console.log("Debt presentation checks passed.");
