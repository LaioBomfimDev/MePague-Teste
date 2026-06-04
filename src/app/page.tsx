"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowRight, Bell, CalendarClock, PieChart, Plus, Smartphone, TrendingUp, Wallet, X } from "lucide-react";
import Image from "next/image";
import ChargeMessageButton from "@/components/ChargeMessageButton";
import ThemeSelector from "@/components/ThemeSelector";
import Toast from "@/components/Toast";
import OnboardingWizard from "@/components/OnboardingWizard";
import { useAppData } from "@/hooks/useAppData";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import {
  formatCurrency,
  formatDate,
  getDebtTimingLabel,
} from "@/lib/format";

export default function Dashboard() {
  const { debts, loading, profile, stats, user } = useAppData();
  const notifications = usePushNotifications();
  const pwa = usePwaInstall();
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "info" | "error">("success");
  const attentionCount = stats.overdueCount + stats.dueTodayCount + stats.dueSoonCount;
  const dismissNotificationPrompt = notifications.dismissPrompt;
  const dismissPwaPrompt = pwa.dismiss;
  const notificationPromptTitleId = useId();
  const pwaPromptTitleId = useId();

  const [onboardingDelayPassed, setOnboardingDelayPassed] = useState(false);

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => setOnboardingDelayPassed(true), 1500);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const [initialPixKeyChecked, setInitialPixKeyChecked] = useState(false);
  const [hasInitialPixKey, setHasInitialPixKey] = useState(true);

  useEffect(() => {
    if (!loading && profile && !initialPixKeyChecked) {
      setHasInitialPixKey(Boolean(profile.pixKey));
      setInitialPixKeyChecked(true);
    }
  }, [loading, profile, initialPixKeyChecked]);

  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  const showOnboarding = onboardingDelayPassed && profile && !hasInitialPixKey && !onboardingCompleted;

  const showPwaPrompt = onboardingDelayPassed && pwa.supported && !pwa.promptDismissed && !showOnboarding;
  const showNotificationPrompt =
    onboardingDelayPassed &&
    notifications.canAsk &&
    !notifications.promptDismissed &&
    !notifications.dailyRemindersEnabled &&
    !showPwaPrompt &&
    !showOnboarding;

  const recentDebts = debts.slice(0, 3);
  const reminderDebts = useMemo(
    () =>
      debts
        .filter((debt) => debt.status === "open" && (debt.isOverdue || debt.daysUntilDue <= 1))
        .sort((a, b) => b.daysOverdue - a.daysOverdue || a.daysUntilDue - b.daysUntilDue)
        .slice(0, 3),
    [debts],
  );

  // Scroll lock para os modais do Dashboard
  useEffect(() => {
    const shouldLock = showPwaPrompt || showNotificationPrompt || showOnboarding;
    if (shouldLock) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showPwaPrompt, showNotificationPrompt, showOnboarding]);

  useEffect(() => {
    if (!showNotificationPrompt) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismissNotificationPrompt();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dismissNotificationPrompt, showNotificationPrompt]);

  useEffect(() => {
    if (!showPwaPrompt) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismissPwaPrompt();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dismissPwaPrompt, showPwaPrompt]);

  async function handleInstallPwa() {
    setNotice("");

    try {
      const installed = await pwa.install();
      if (installed) {
        setNoticeTone("success");
        setNotice("App adicionado com sucesso!");
        window.setTimeout(() => setNotice(""), 2400);
      }
    } catch {
      setNoticeTone("error");
      setNotice("Não foi possível adicionar o atalho.");
      window.setTimeout(() => setNotice(""), 2400);
    }
  }

  async function handleEnableNotifications() {
    setNotice("");

    try {
      await notifications.enable();
      setNoticeTone("success");
      setNotice("Notificações ativadas para as 8h.");
      window.setTimeout(() => setNotice(""), 2400);
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "Não foi possível ativar as notificações.");
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
          <Image src="/logo.png" alt="Me Pague Logo" width={44} height={44} className="rounded-xl shadow-sm" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-black">Me Pague</h1>
            <p className="text-ios-gray text-[13px] font-medium leading-tight">Controle de débitos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSelector />
          <Link
            href="/profile"
            className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center text-black font-semibold overflow-hidden transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ios-blue focus-visible:ring-offset-2"
            aria-label="Abrir ajustes do perfil"
            title="Abrir ajustes"
          >
            {profile?.name?.[0]?.toUpperCase() || "M"}
          </Link>
        </div>
      </header>

      {showPwaPrompt && typeof document !== "undefined" && createPortal(
        <PwaInstallModal
          onClose={dismissPwaPrompt}
          onInstall={handleInstallPwa}
          titleId={pwaPromptTitleId}
          isIOS={pwa.isIOS}
        />,
        document.body,
      )}

      {showNotificationPrompt && typeof document !== "undefined" && createPortal(
        <NotificationPermissionModal
          onClose={dismissNotificationPrompt}
          onEnable={handleEnableNotifications}
          saving={notifications.saving}
          titleId={notificationPromptTitleId}
        />,
        document.body,
      )}

      {showOnboarding && typeof document !== "undefined" && createPortal(
        <OnboardingWizard
          userName={profile?.name}
          onComplete={() => setOnboardingCompleted(true)}
        />,
        document.body,
      )}

      <section className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-ios space-y-6 animate-emerge stagger-1">
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

      <section className="grid grid-cols-4 gap-3 animate-emerge stagger-2">
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
          <h3 className="text-lg font-bold text-black">Cobranças Recentes</h3>
          <Link href="/debtors" className="text-ios-blue text-sm font-semibold flex items-center gap-0.5">
            Ver tudo <ArrowRight size={14} />
          </Link>
        </div>

        {recentDebts.length === 0 ? (
          <div className="ios-tile p-6 bg-white text-center">
            <p className="font-semibold text-gray-900">Nenhuma dívida cadastrada</p>
            <p className="text-sm text-ios-gray mt-1">Cadastre a primeira cobrança para acompanhar seus recebimentos.</p>
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

function PwaInstallModal({
  onClose,
  onInstall,
  titleId,
  isIOS,
}: {
  onClose: () => void;
  onInstall: () => void;
  titleId: string;
  isIOS?: boolean;
}) {
  const descriptionId = `${titleId}-description`;

  return (
    <div className="app-modal z-[110]">
      <button type="button" aria-label="Fechar instalação do app" className="app-modal__backdrop" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="app-modal__panel relative w-full max-w-sm rounded-[1.4rem] bg-white p-5 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-400 btn-press"
          aria-label="Fechar"
        >
          <X size={17} />
        </button>

        <div className="mx-auto h-14 w-14 overflow-hidden rounded-2xl bg-white shadow-sm">
          <Image src="/logo.png" alt="Me Pague" width={56} height={56} className="h-full w-full object-cover" />
        </div>

        {isIOS ? (
          <div className="mt-4 space-y-4 text-center">
            <h2 id={titleId} className="text-xl font-bold text-gray-950">
              Instalar no iPhone
            </h2>
            <div id={descriptionId} className="text-left text-sm text-gray-600 space-y-3 bg-gray-50 p-4 rounded-2xl">
              <p className="flex gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 bg-gray-200 text-gray-800 text-[11px] font-bold rounded-full">1</span>
                <span>Toque no botão de <strong>Compartilhar</strong> (ícone na barra inferior do Safari).</span>
              </p>
              <p className="flex gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 bg-gray-200 text-gray-800 text-[11px] font-bold rounded-full">2</span>
                <span>Role a lista e selecione <strong>Adicionar à Tela de Início</strong>.</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full flex min-h-12 items-center justify-center rounded-xl bg-gray-900 px-3 text-sm font-semibold text-white btn-press mt-2"
            >
              Entendido
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-2 text-center">
              <h2 id={titleId} className="text-xl font-bold text-gray-950">
                Adicionar atalho?
              </h2>
              <p id={descriptionId} className="mx-auto max-w-[17rem] text-sm leading-5 text-gray-500">
                Instale o Me Pague na área de trabalho ou na tela inicial do seu celular para acesso rápido e offline.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-12 items-center justify-center rounded-xl bg-gray-50 px-3 text-sm font-semibold text-gray-600 btn-press"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={onInstall}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 text-sm font-semibold text-white btn-press"
              >
                <Smartphone size={16} strokeWidth={2.3} />
                Adicionar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NotificationPermissionModal({
  onClose,
  onEnable,
  saving,
  titleId,
}: {
  onClose: () => void;
  onEnable: () => void;
  saving: boolean;
  titleId: string;
}) {
  const descriptionId = `${titleId}-description`;

  return (
    <div className="app-modal z-[110]">
      <button type="button" aria-label="Fechar convite de notificações" className="app-modal__backdrop" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="app-modal__panel relative w-full max-w-sm rounded-[1.4rem] bg-white p-5 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-400 btn-press"
          aria-label="Agora não"
        >
          <X size={17} />
        </button>

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
          <Bell size={24} strokeWidth={2.2} />
        </div>

        <div className="mt-4 space-y-2 text-center">
          <h2 id={titleId} className="text-xl font-bold text-gray-950">
            Receber avisos às 8h?
          </h2>
          <p id={descriptionId} className="mx-auto max-w-[17rem] text-sm leading-5 text-gray-500">
            Quando houver recebimento para amanhã, o Me Pague te avisa.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-12 items-center justify-center rounded-xl bg-gray-50 px-3 text-sm font-semibold text-gray-600 btn-press"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={onEnable}
            disabled={saving}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 text-sm font-semibold text-white disabled:opacity-50 btn-press"
          >
            <Bell size={16} strokeWidth={2.3} />
            {saving ? "Ativando..." : "Ativar"}
          </button>
        </div>
      </div>
    </div>
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
