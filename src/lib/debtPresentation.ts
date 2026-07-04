import type { DebtStatus } from "@/lib/types";

export type DebtCardAction = "pay" | "edit" | "delete" | "charge" | "reopen";
export type DebtSummaryTone = "danger" | "info" | "success";
export type NextChargeActionTone = "danger" | "warning" | "info" | "success" | "neutral";

export type NextChargeAction = {
  actionLabel: string;
  detail: string;
  label: string;
  shouldCharge: boolean;
  tone: NextChargeActionTone;
};

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

export function getNextChargeAction(input: {
  dueSoonCount: number;
  dueTodayCount: number;
  lastChargedAt?: string | null;
  maxDaysOverdue: number;
  openCount: number;
  overdueCount: number;
  today?: Date;
}): NextChargeAction {
  if (input.openCount === 0) {
    return {
      actionLabel: "Acompanhar",
      detail: "Nenhuma cobrança em aberto agora.",
      label: "Tudo pago",
      shouldCharge: false,
      tone: "success",
    };
  }

  const daysSinceCharge = getDaysSince(input.lastChargedAt, input.today);

  if (daysSinceCharge !== null && daysSinceCharge <= 0) {
    return {
      actionLabel: "Acompanhar",
      detail: "A última cobrança foi registrada hoje.",
      label: "Aguardar retorno",
      shouldCharge: false,
      tone: "info",
    };
  }

  if (input.overdueCount > 0) {
    const countLabel = `${input.overdueCount} cobrança${input.overdueCount === 1 ? "" : "s"}`;
    const delayLabel =
      input.maxDaysOverdue > 0
        ? `até ${input.maxDaysOverdue} dia${input.maxDaysOverdue === 1 ? "" : "s"} de atraso`
        : "em atraso";

    return {
      actionLabel: "Cobrar",
      detail: `${countLabel} ${delayLabel}.`,
      label: "Cobrar atraso agora",
      shouldCharge: true,
      tone: "danger",
    };
  }

  if (input.dueTodayCount > 0) {
    return {
      actionLabel: "Lembrar",
      detail: `${input.dueTodayCount} cobrança${input.dueTodayCount === 1 ? "" : "s"} vence${input.dueTodayCount === 1 ? "" : "m"} hoje.`,
      label: "Lembrar vencimento hoje",
      shouldCharge: true,
      tone: "warning",
    };
  }

  if (input.dueSoonCount > 0) {
    return {
      actionLabel: "Avisar",
      detail: `${input.dueSoonCount} cobrança${input.dueSoonCount === 1 ? "" : "s"} vence${input.dueSoonCount === 1 ? "" : "m"} nos próximos 7 dias.`,
      label: "Avisar antes do prazo",
      shouldCharge: true,
      tone: "info",
    };
  }

  return {
    actionLabel: "Acompanhar",
    detail: "Próximo vencimento ainda não exige cobrança.",
    label: "Só acompanhar",
    shouldCharge: false,
    tone: "neutral",
  };
}

function getDaysSince(value?: string | null, today = new Date()) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const todayStart = startOfDay(today).getTime();
  const dateStart = startOfDay(date).getTime();

  return Math.floor((todayStart - dateStart) / 86400000);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}
