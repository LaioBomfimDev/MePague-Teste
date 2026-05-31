"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Bell, CalendarClock, PieChart, Plus, TrendingUp, Wallet, X } from "lucide-react";
import Image from "next/image";
import ChargeMessageButton from "@/components/ChargeMessageButton";
import ThemeSelector from "@/components/ThemeSelector";
import Toast from "@/components/Toast";
import { useAppData } from "@/hooks/useAppData";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  formatCurrency,
  formatDate,
  getDebtTimingLabel,
} from "@/lib/format";

export default function Dashboard() {
  const { chargeLogs, debts, loading, profile, stats, user } = useAppData();
  const notifications = usePushNotifications();
  const [hideOnboarding, setHideOnboarding] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "info" | "error">("success");
  const attentionCount = stats.overdueCount + stats.dueTodayCount + stats.dueSoonCount;
  const recentDebts = debts.slice(0, 3);
  const reminderDebts = useMemo(
    () =>
      debts
        .filter((debt) => debt.status === "open" && (debt.isOverdue || debt.daysUntilDue <= 1))
        .sort((a, b) => b.daysOverdue - a.daysOverdue || a.daysUntilDue - b.daysUntilDue)
        .slice(0, 3),
    [debts],
  );

  useEffect(() => {
    setHideOnboarding(window.localStorage.getItem("me-pague:onboarding-hidden") === "true");
  }, []);

  async function handleEnableNotifications() {
    setNotice("");

    try {
      await notifications.enable();
      setNoticeTone("success");
      setNotice("Notificacoes ativadas para as 8h.");
      window.setTimeout(() => setNotice(""), 2400);
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "Nao foi possivel ativar notificacoes.");
      window.setTimeout(() => setNotice(""), 3000);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-8 animate-pulse">
        <div className="h-10 w-40 bg-gray-100 rounded-xl" />
        <div className="h-48 w-full bg-gray-50 rounded-[2rem]" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-gray-50 rounded-2xl" />
          <div className="h-32 bg-gray-50 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-32 space-y-7 ios-fade-in">
      <Toast message={notice} tone={noticeTone} />
      <header className="pt-4 flex justify-between items-center px-1">
        <div className="flex items-center gap-3">
          <Image src="/logo.jpeg" alt="Me Pague Logo" width={44} height={44} className="rounded-xl shadow-sm" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-black">Me Pague</h1>
            <p className="text-ios-gray text-[13px] font-medium leading-tight">Controle de debitos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSelector />
          <div className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center text-black font-semibold overflow-hidden">
            {profile?.name?.[0]?.toUpperCase() || "M"}
          </div>
        </div>
      </header>

      {!hideOnboarding && (!profile?.pixKey || debts.length === 0 || chargeLogs.length === 0) && (
        <section className="card rounded-[18px] p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-sm text-gray-900">Primeiros passos</h2>
              <p className="text-xs text-gray-400 mt-0.5">Deixe o app pronto para cobrar em poucos toques.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem("me-pague:onboarding-hidden", "true");
                setHideOnboarding(true);
              }}
              className="text-xs font-semibold text-gray-400"
            >
              Ocultar
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <OnboardingStep done={Boolean(profile?.pixKey)} href="/profile" label="Adicionar Pix" />
            <OnboardingStep done={debts.length > 0} href="/new-debt" label="Cadastrar divida" />
            <OnboardingStep done={chargeLogs.length > 0} href="/debtors?filter=open" label="Mandar cobranca" />
          </div>
        </section>
      )}

      {notifications.canAsk && !notifications.promptDismissed && !notifications.dailyRemindersEnabled && (
        <section className="card rounded-[18px] p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
              <Bell size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-sm text-gray-900">Receber avisos as 8h?</h2>
              <p className="text-xs text-gray-400 mt-1">Quando houver recebimento para amanha, o Me Pague te avisa.</p>
            </div>
            <button
              type="button"
              onClick={notifications.dismissPrompt}
              className="w-8 h-8 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center btn-press"
              aria-label="Ocultar convite de notificacoes"
            >
              <X size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={notifications.saving}
            className="w-full rounded-xl bg-gray-900 text-white py-3 text-sm font-semibold disabled:opacity-50 btn-press"
          >
            {notifications.saving ? "Ativando..." : "Ativar notificacoes"}
          </button>
        </section>
      )}

      <section className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-ios space-y-6">
        <div>
          <p className="text-[13px] font-semibold text-ios-gray uppercase tracking-tight">Total a receber</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-4xl font-bold tracking-tight text-black">{formatCurrency(stats.totalOpen)}</span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link
            href="/debtors?filter=overdue"
            className="px-4 py-2 bg-red-50 text-red-500 rounded-full text-xs font-semibold flex items-center gap-1.5 btn-press"
          >
            <AlertCircle size={14} />
            {stats.overdueCount} atrasada{stats.overdueCount === 1 ? "" : "s"}
          </Link>
          <Link
            href="/debtors?filter=due-today"
            className="px-4 py-2 bg-green-50 text-green-600 rounded-full text-xs font-semibold flex items-center gap-1.5 btn-press"
          >
            <CalendarClock size={14} />
            {stats.dueTodayCount} vence{stats.dueTodayCount === 1 ? "" : "m"} hoje
          </Link>
          <Link
            href="/debtors?filter=open"
            className="px-4 py-2 bg-ios-soft-blue text-ios-blue rounded-full text-xs font-semibold btn-press"
          >
            {stats.openCount} em aberto
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-3">
        <ShortcutLink href="/new-debt" label="Nova" icon={Plus} bg="bg-gray-900" color="text-white" />
        <ShortcutLink href="/debtors?filter=overdue" label="Atrasadas" icon={AlertCircle} bg="bg-red-50" color="text-red-500" />
        <ShortcutLink href="/debtors?filter=due-today" label="Hoje" icon={CalendarClock} bg="bg-green-50" color="text-green-600" />
        <ShortcutLink href="/reports" label="Resumo" icon={PieChart} bg="bg-blue-50" color="text-ios-blue" />
      </section>

      <div className="grid grid-cols-2 gap-4">
        <Link href="/reports" className="ios-tile p-5 bg-ios-soft-blue/30 flex flex-col justify-between h-36">
          <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-ios-blue">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-ios-gray">Recebido</p>
            <p className="text-xl font-bold text-black mt-0.5">{formatCurrency(stats.totalPaid)}</p>
          </div>
        </Link>
        <Link href="/reports" className="ios-tile p-5 bg-ios-soft-purple/30 flex flex-col justify-between h-36">
          <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-purple-500">
            <Wallet size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-ios-gray">Pagas</p>
            <p className="text-xl font-bold text-black mt-0.5">{stats.paidCount}</p>
          </div>
        </Link>
      </div>

      {reminderDebts.length > 0 && (
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-lg font-bold text-black">Cobrar hoje</h3>
            <Link href="/debtors?filter=due-today" className="text-xs font-semibold text-ios-blue">
              {attentionCount} no radar
            </Link>
          </div>

          <div className="space-y-3">
            {reminderDebts.map((debt) => (
              <div key={debt.id} className="ios-tile p-4 bg-white flex items-center gap-3">
                <Link href={`/debtors/${debt.customerId}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${debt.isOverdue ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>
                    <CalendarClock size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{debt.customerName}</p>
                    <p className="text-xs text-ios-gray">{getDebtTimingLabel(debt)}</p>
                  </div>
                </Link>
                <ChargeMessageButton
                  amount={debt.outstandingAmount}
                  customerId={debt.customerId}
                  daysOverdue={debt.daysOverdue}
                  debtId={debt.id}
                  debtorName={debt.customerName}
                  defaultTone={debt.isOverdue ? "overdue" : "friendly"}
                  description={debt.description}
                  dueDate={debt.dueDate}
                  phone={debt.customerPhone}
                  pixKey={profile?.pixKey}
                  userId={user?.id}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-lg font-bold text-black">Cobrancas Recentes</h3>
          <Link href="/debtors" className="text-ios-blue text-sm font-semibold flex items-center gap-0.5">
            Ver tudo <ArrowRight size={14} />
          </Link>
        </div>

        {recentDebts.length === 0 ? (
          <div className="ios-tile p-6 bg-white text-center">
            <p className="font-semibold text-gray-900">Nenhuma divida cadastrada</p>
            <p className="text-sm text-ios-gray mt-1">Cadastre a primeira cobranca para acompanhar seus recebimentos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentDebts.map((debt) => (
              <Link key={debt.id} href={`/debtors/${debt.customerId}`} className="ios-tile p-4 flex items-center gap-4 bg-white">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-ios-gray font-bold italic">
                  {debt.customerName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-[15px] text-black truncate">{debt.customerName}</h4>
                  <p className="text-[13px] text-ios-gray">Vence em {formatDate(debt.dueDate)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[15px]">{formatCurrency(debt.status === "paid" ? debt.paidAmount : debt.outstandingAmount)}</p>
                  <div className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${debt.isOverdue ? "text-red-500 bg-red-50" : "text-ios-blue bg-ios-soft-blue"}`}>
                    {debt.isOverdue ? "Atrasou" : debt.status === "paid" ? "Pago" : "Aberta"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Link
        href="/new-debt"
        className="fixed bottom-28 right-8 w-14 h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center z-50 transition-transform active:scale-90 hover:scale-105"
      >
        <Plus size={28} strokeWidth={2.5} />
      </Link>
    </div>
  );
}

function OnboardingStep({ done, href, label }: { done: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`p-3 rounded-xl text-center text-xs font-semibold ${
        done ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-600"
      }`}
    >
      <span className="block text-base">{done ? "OK" : "+"}</span>
      {label}
    </Link>
  );
}

function ShortcutLink({
  bg,
  color,
  href,
  icon: Icon,
  label,
}: {
  bg: string;
  color: string;
  href: string;
  icon: typeof Plus;
  label: string;
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-2 text-center btn-press">
      <span className={`w-12 h-12 rounded-2xl ${bg} ${color} flex items-center justify-center shadow-ios`}>
        <Icon size={21} strokeWidth={2.2} />
      </span>
      <span className="text-[11px] font-semibold text-gray-600 leading-tight">{label}</span>
    </Link>
  );
}
