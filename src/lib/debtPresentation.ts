import type { DebtStatus } from "@/lib/types";

export type DebtCardAction = "pay" | "edit" | "delete" | "charge" | "reopen";
export type DebtSummaryTone = "danger" | "info" | "success";

export function getDebtCardActions(status: DebtStatus): DebtCardAction[] {
  if (status === "paid") {
    return ["reopen", "delete"];
  }

  return ["pay", "edit", "delete", "charge"];
}

export function getOpenDebtSummary(openCount: number, overdueCount: number): { label: string; tone: DebtSummaryTone } {
  if (overdueCount > 0) {
    return {
      label: `${overdueCount} atrasada${overdueCount === 1 ? "" : "s"}`,
      tone: "danger",
    };
  }

  if (openCount > 0) {
    return {
      label: `${openCount} aberta${openCount === 1 ? "" : "s"}`,
      tone: "info",
    };
  }

  return {
    label: "Tudo pago",
    tone: "success",
  };
}
