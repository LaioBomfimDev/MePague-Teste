"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Share2, TrendingDown, TrendingUp } from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import { SkeletonChart, SkeletonListItem } from "@/components/Skeleton";
import { useAppData } from "@/hooks/useAppData";
import { formatCurrency, formatDate } from "@/lib/format";
import { downloadReportPdf } from "@/lib/reportPdf";
import type { DashboardStats, DebtWithCustomer, Payment } from "@/lib/types";

export default function ReportsPage() {
  const { debts, loading, payments, stats } = useAppData();
  const [selectedMonth, setSelectedMonth] = useState("all");
  const monthOptions = useMemo(() => buildMonthOptions(debts), [debts]);
  const filteredDebts = useMemo(
    () =>
      selectedMonth === "all"
        ? debts
        : debts.filter((debt) => getDebtReportMonthKey(debt) === selectedMonth),
    [debts, selectedMonth],
  );
  const reportStats = useMemo(
    () => (selectedMonth === "all" ? stats : calculateStats(filteredDebts)),
    [filteredDebts, selectedMonth, stats],
  );
  const weeklyBars = useMemo(() => buildWeeklyBars(filteredDebts), [filteredDebts]);
  const topDebtors = useMemo(() => buildTopDebtors(filteredDebts), [filteredDebts]);
  const receivedPayments = useMemo(
    () =>
      selectedMonth === "all"
        ? payments
        : payments.filter((payment) => payment.paidAt.slice(0, 7) === selectedMonth),
    [payments, selectedMonth],
  );
  const receivedInPeriod = receivedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const periodLabel = selectedMonth === "all" ? "Todos os periodos" : formatMonthName(selectedMonth);

  return (
    <div className="p-5 pb-28 space-y-5 page-transition">
      <MobileHeader
        title="Relatorios"
        subtitle={periodLabel}
        fallbackHref="/"
        action={
          <button
            onClick={() => downloadReportPdf({ debts: filteredDebts, payments: receivedPayments, stats: reportStats, periodLabel })}
            className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center btn-press hover:bg-gray-200 transition-colors"
            aria-label="Baixar relatorio em PDF"
          >
            <Download size={20} strokeWidth={1.8} />
          </button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <SkeletonChart />
          <SkeletonListItem />
          <SkeletonListItem />
        </div>
      ) : (
        <div className="stagger-fade space-y-4">
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-700 animate-emerge"
          >
            <option value="all">Todos os periodos</option>
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatMonthName(month)}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Recebido no periodo"
              value={formatCurrency(receivedInPeriod)}
              icon={TrendingUp}
              color="text-green-500"
              bg="bg-green-50"
            />
            <MetricCard
              label="Previsto 7 dias"
              value={formatCurrency(reportStats.forecast7Days)}
              icon={FileText}
              color="text-blue-500"
              bg="bg-blue-50"
            />
          </div>

          <div className="card rounded-[18px] p-6 space-y-6">
            <div className="flex justify-between items-end h-40 gap-2">
              {weeklyBars.map((bar) => (
                <div key={bar.label} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                  <div
                    className={`w-full rounded-t-md transition-all duration-700 ${bar.amount === weeklyBars[0]?.max ? "bg-gray-900" : "bg-gray-200"}`}
                    style={{ height: `${bar.height}%` }}
                    title={formatCurrency(bar.amount)}
                  />
                  <span className="text-[10px] text-gray-400 font-medium">{bar.label}</span>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-dashed border-gray-100 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Total em aberto</p>
                <p className="text-xl font-semibold text-gray-900 mt-0.5">{formatCurrency(reportStats.totalOpen)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Em atraso</p>
                <p className="text-xl font-semibold text-red-500 mt-0.5">{formatCurrency(reportStats.totalOverdue)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Recebido"
              value={formatCurrency(reportStats.totalPaid)}
              icon={TrendingUp}
              color="text-green-500"
              bg="bg-green-50"
            />
            <MetricCard
              label="Pendente"
              value={formatCurrency(reportStats.totalOpen)}
              icon={TrendingDown}
              color="text-red-400"
              bg="bg-red-50"
            />
            <MetricCard
              label="Cobrancas abertas"
              value={String(reportStats.openCount)}
              icon={FileText}
              color="text-blue-500"
              bg="bg-blue-50"
            />
            <MetricCard
              label="Previsto 30 dias"
              value={formatCurrency(reportStats.forecast30Days)}
              icon={Share2}
              color="text-purple-500"
              bg="bg-purple-50"
            />
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 px-1">Maiores devedores</h2>
            {topDebtors.length === 0 ? (
              <div className="card rounded-[14px] p-4 text-sm text-gray-400 text-center">
                Nenhum valor em aberto neste periodo.
              </div>
            ) : (
              topDebtors.map((debtor) => (
                <div key={debtor.id} className="card rounded-[14px] p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{debtor.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {debtor.count} cobranca{debtor.count === 1 ? "" : "s"} em aberto
                    </p>
                  </div>
                  <p className="font-semibold text-sm text-gray-900">{formatCurrency(debtor.amount)}</p>
                </div>
              ))
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 px-1">Historico recente</h2>
            {filteredDebts.length === 0 ? (
              <div className="card rounded-[14px] p-4 text-sm text-gray-400 text-center">
                Sem movimentacoes neste periodo.
              </div>
            ) : (
              filteredDebts.slice(0, 6).map((debt) => (
                <div key={debt.id} className="card rounded-[14px] p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{debt.customerName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {debt.status === "paid" ? "Pago" : debt.isOverdue ? "Atrasada" : "Aberta"} · {formatDate(debt.dueDate)}
                    </p>
                  </div>
                  <p className={`font-semibold text-sm ${debt.status === "paid" ? "text-green-500" : "text-gray-900"}`}>
                    {formatCurrency(debt.status === "paid" ? debt.amount : debt.amountWithInterest)}
                  </p>
                </div>
              ))
            )}
          </section>

          <div className="grid grid-cols-2 gap-2 animate-emerge stagger-2">
            <button
              onClick={() => exportCsv(filteredDebts, receivedPayments, periodLabel)}
              className="w-full p-4 card border-gray-200 text-gray-900 rounded-xl font-medium text-sm flex items-center justify-center gap-2 btn-press"
            >
              <Download size={18} strokeWidth={1.8} />
              CSV
            </button>
            <button
              onClick={() => downloadReportPdf({ debts: filteredDebts, payments: receivedPayments, stats: reportStats, periodLabel })}
              className="w-full p-4 card border-gray-200 text-gray-900 rounded-xl font-medium text-sm flex items-center justify-center gap-2 btn-press"
            >
              <FileText size={18} strokeWidth={1.8} />
              Baixar PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  bg,
  color,
  icon: Icon,
  label,
  value,
}: {
  bg: string;
  color: string;
  icon: typeof TrendingUp;
  label: string;
  value: string;
}) {
  return (
    <div className="card rounded-[14px] p-4 space-y-3">
      <div className={`w-9 h-9 rounded-lg ${bg} ${color} flex items-center justify-center`}>
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="font-semibold text-sm text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function calculateStats(debts: DebtWithCustomer[]): DashboardStats {
  return debts.reduce(
    (acc, debt) => {
      if (debt.status === "paid") {
        acc.totalPaid += debt.paidAmount || debt.amount;
        acc.paidCount += 1;
        return acc;
      }

      acc.totalOpen += debt.outstandingAmount;
      acc.totalOriginalOpen += debt.amount;
      acc.totalPaid += debt.paidAmount;
      acc.openCount += 1;

      if (debt.isOverdue) {
        acc.overdueCount += 1;
        acc.totalOverdue += debt.outstandingAmount;
      }

      if (debt.daysUntilDue === 0 && !debt.isOverdue) {
        acc.dueTodayCount += 1;
      }

      if (debt.daysUntilDue > 0 && debt.daysUntilDue <= 7) {
        acc.dueSoonCount += 1;
      }

      if (debt.daysUntilDue <= 7 || debt.isOverdue) {
        acc.forecast7Days += debt.outstandingAmount;
      }

      if (debt.daysUntilDue <= 30 || debt.isOverdue) {
        acc.forecast30Days += debt.outstandingAmount;
      }

      return acc;
    },
    {
      dueSoonCount: 0,
      dueTodayCount: 0,
      openCount: 0,
      overdueCount: 0,
      paidCount: 0,
      totalOpen: 0,
      totalOriginalOpen: 0,
      totalOverdue: 0,
      totalPaid: 0,
      forecast7Days: 0,
      forecast30Days: 0,
    },
  );
}

function getDebtReportDate(debt: DebtWithCustomer) {
  return debt.status === "paid" && debt.paidAt ? debt.paidAt.slice(0, 10) : debt.dueDate;
}

function getDebtReportMonthKey(debt: DebtWithCustomer) {
  return getDebtReportDate(debt).slice(0, 7);
}

function buildMonthOptions(debts: DebtWithCustomer[]) {
  return Array.from(new Set(debts.map(getDebtReportMonthKey))).sort((a, b) => b.localeCompare(a));
}

function formatMonthName(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function buildWeeklyBars(debts: DebtWithCustomer[]) {
  const totals = [0, 0, 0, 0, 0];

  debts.forEach((debt) => {
    const day = Number(getDebtReportDate(debt).slice(8, 10));
    const week = Math.min(4, Math.floor((day - 1) / 7));
    totals[week] += debt.status === "paid" ? debt.paidAmount || debt.amount : debt.outstandingAmount;
  });

  const max = Math.max(...totals, 1);

  return totals.map((amount, index) => ({
    amount,
    height: amount === 0 ? 12 : Math.max(18, Math.round((amount / max) * 100)),
    label: `S${index + 1}`,
    max,
  }));
}

function buildTopDebtors(debts: DebtWithCustomer[]) {
  const grouped = new Map<string, { id: string; name: string; amount: number; count: number }>();

  debts
    .filter((debt) => debt.status === "open")
    .forEach((debt) => {
      const current = grouped.get(debt.customerId) || {
        id: debt.customerId,
        name: debt.customerName,
        amount: 0,
        count: 0,
      };

      current.amount += debt.outstandingAmount;
      current.count += 1;
      grouped.set(debt.customerId, current);
    });

  return Array.from(grouped.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

function exportCsv(debts: DebtWithCustomer[], payments: Payment[], periodLabel: string) {
  const header = ["periodo", "cliente", "telefone", "descricao", "vencimento", "status", "valor_original", "pago", "saldo"];
  const rows = debts.map((debt) => [
    periodLabel,
    debt.customerName,
    debt.customerPhone,
    debt.description,
    debt.dueDate,
    debt.status,
    debt.amount.toFixed(2),
    debt.paidAmount.toFixed(2),
    debt.outstandingAmount.toFixed(2),
  ]);
  const paymentRows = payments.map((payment) => [
    periodLabel,
    "Pagamento",
    "",
    payment.note || "",
    payment.paidAt.slice(0, 10),
    "received",
    "",
    payment.amount.toFixed(2),
    "",
  ]);
  const csv = [header, ...rows, ...paymentRows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `me-pague-${periodLabel.toLowerCase().replace(/\s+/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
