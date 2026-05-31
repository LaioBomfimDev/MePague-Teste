import type { ChargeLog, Debt, DebtWithCustomer, MessageTone, Payment } from "@/lib/types";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(value: string) {
  if (!value) return "Sem vencimento";

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "MP";
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function formatPhoneInput(value: string) {
  const digits = normalizePhone(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function parseCurrencyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";

  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function addMonthsToDateString(value: string, months: number) {
  const date = parseLocalDate(value);
  const originalDay = date.getDate();
  date.setMonth(date.getMonth() + months);

  if (date.getDate() !== originalDay) {
    date.setDate(0);
  }

  return toDateInputValue(date);
}

export function addWeeksToDateString(value: string, weeks: number) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + weeks * 7);
  return toDateInputValue(date);
}

export function parseInstallmentInfo(description: string) {
  const match = description.match(/^Parcela\s+(\d+)\/(\d+)(?:\s+-\s+(.+))?$/i);

  if (!match) {
    return {
      baseDescription: description,
      installmentGroupKey: undefined,
      installmentIndex: undefined,
      installmentTotal: undefined,
    };
  }

  const installmentIndex = Number(match[1]);
  const installmentTotal = Number(match[2]);
  const baseDescription = match[3] || "Parcelado";

  return {
    baseDescription,
    installmentGroupKey: `${baseDescription}-${installmentTotal}`,
    installmentIndex,
    installmentTotal,
  };
}

export function enhanceDebt(debt: Debt, payments: Payment[] = [], chargeLogs: ChargeLog[] = []): DebtWithCustomer {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = parseLocalDate(debt.dueDate);

  const diffInMs = today.getTime() - dueDate.getTime();
  const diffInDays = Math.floor(diffInMs / 86400000);
  const daysOverdue = debt.status === "open" ? Math.max(0, Math.floor(diffInMs / 86400000)) : 0;
  const daysUntilDue = debt.status === "open" ? Math.max(0, -diffInDays) : 0;
  const amountWithInterest = debt.amount + debt.amount * (debt.dailyInterest / 100) * daysOverdue;
  const paidAmount =
    debt.status === "paid" && payments.filter((payment) => payment.debtId === debt.id).length === 0
      ? amountWithInterest
      : payments
          .filter((payment) => payment.debtId === debt.id)
          .reduce((sum, payment) => sum + payment.amount, 0);
  const outstandingAmount = Math.max(0, amountWithInterest - paidAmount);
  const lastChargedAt = chargeLogs
    .filter((log) => log.debtId === debt.id || log.customerId === debt.customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt;
  const installmentInfo = parseInstallmentInfo(debt.description);

  return {
    ...debt,
    isOverdue: daysOverdue > 0,
    daysOverdue,
    daysUntilDue,
    amountWithInterest,
    outstandingAmount,
    paidAmount,
    lastChargedAt,
    ...installmentInfo,
  };
}

export function buildWhatsappUrl(phone: string, message: string) {
  const normalizedPhone = normalizePhone(phone);
  const text = encodeURIComponent(message);

  if (!normalizedPhone) {
    return `https://wa.me/?text=${text}`;
  }

  const target = normalizedPhone.startsWith("55") ? normalizedPhone : `55${normalizedPhone}`;

  return `https://wa.me/${target}?text=${text}`;
}

export function getDebtTimingLabel(debt: DebtWithCustomer) {
  if (debt.status === "paid") return "Pago";
  if (debt.paidAmount > 0) return `Parcial: falta ${formatCurrency(debt.outstandingAmount)}`;
  if (debt.daysOverdue > 0) return `${debt.daysOverdue} dia${debt.daysOverdue === 1 ? "" : "s"} atrasada`;
  if (debt.daysUntilDue === 0) return "Vence hoje";

  return `Vence em ${debt.daysUntilDue} dia${debt.daysUntilDue === 1 ? "" : "s"}`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export type ChargeMessageInput = {
  debtorName: string;
  amount: number;
  pixKey?: string;
  tone: MessageTone;
  dueDate?: string;
  daysOverdue?: number;
  debtsCount?: number;
  description?: string;
};

export type ChargeMessageParts = {
  amount: string;
  delay: string;
  detail: string;
  due: string;
  firstName: string;
  pix: string;
};

export function getChargeMessageParts(input: ChargeMessageInput): ChargeMessageParts {
  const firstName = input.debtorName.split(" ").filter(Boolean)[0] || input.debtorName;
  const amount = formatCurrency(input.amount);
  const pix = input.pixKey ? ` Minha chave Pix: ${input.pixKey}.` : "";
  const description = input.description ? ` (${input.description})` : "";
  const count =
    input.debtsCount && input.debtsCount > 1
      ? ` referente a ${input.debtsCount} cobrancas em aberto`
      : description;
  const due = input.dueDate ? ` com vencimento em ${formatDate(input.dueDate)}` : "";
  const delay =
    input.daysOverdue && input.daysOverdue > 0
      ? `ja esta com ${input.daysOverdue} dia${input.daysOverdue === 1 ? "" : "s"} de atraso`
      : "vence hoje";

  return {
    amount,
    delay,
    detail: count,
    due,
    firstName,
    pix,
  };
}

export function buildChargeMessage(input: ChargeMessageInput) {
  const { amount, delay, detail, due, firstName, pix } = getChargeMessageParts(input);

  if (input.tone === "firm") {
    return `Oi, ${firstName}. Estou passando para regularizar o valor em aberto de ${amount}${detail}. Por favor, me envie uma previsao de pagamento hoje.${pix}`;
  }

  if (input.tone === "overdue") {
    return `Oi, ${firstName}. O pagamento de ${amount}${detail} ${delay}. Consegue fazer o Pix ou me passar uma previsao?${pix}`;
  }

  return `Oi, ${firstName}. Tudo bem? Passando para lembrar do valor em aberto de ${amount}${detail}${due}. Quando puder, me chama para combinarmos o pagamento.${pix}`;
}
