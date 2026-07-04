"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { CheckSquare, ChevronRight, Copy, MessageCircle, Search, Send, Square, UserPlus, X } from "lucide-react";
import ChargeMessageButton from "@/components/ChargeMessageButton";
import EditableMessageBox from "@/components/EditableMessageBox";
import MobileHeader from "@/components/MobileHeader";
import { SkeletonListItem } from "@/components/Skeleton";
import { useAppData } from "@/hooks/useAppData";
import { recordChargeLog } from "@/lib/database";
import { buildChargeMessage, buildWhatsappUrl, formatCurrency } from "@/lib/format";
import type { MessageTone } from "@/lib/types";

type DebtorFilter = "open" | "overdue" | "due-today";
type DebtorListItem = {
  amount: number;
  avatar: string;
  debts: number;
  dueToday: number;
  id: string;
  maxDaysOverdue: number;
  name: string;
  nextDueDate?: string;
  overdue: number;
  phone: string;
};

const filterOptions: Array<{ value: DebtorFilter; label: string }> = [
  { value: "open", label: "Em aberto" },
  { value: "overdue", label: "Atrasadas" },
  { value: "due-today", label: "Vence hoje" },
];
const bulkToneOptions: Array<{ value: MessageTone; label: string }> = [
  { value: "friendly", label: "Amigável" },
  { value: "firm", label: "Firme" },
  { value: "overdue", label: "Atraso" },
];

export default function DebtorsPage() {
  const { debts, loading, profile, user } = useAppData();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedDebtorIds, setSelectedDebtorIds] = useState<Set<string>>(() => new Set());
  const currentFilter = getFilter(searchParams.get("filter"));

  const debtors = useMemo(() => {
    const grouped = new Map<string, DebtorListItem>();

    debts
      .filter((debt) => {
        if (debt.status !== "open") return false;
        if (currentFilter === "overdue") return debt.isOverdue;
        if (currentFilter === "due-today") return !debt.isOverdue && debt.daysUntilDue === 0;
        return true;
      })
      .forEach((debt) => {
        const current = grouped.get(debt.customerId) || {
          id: debt.customerId,
          name: debt.customerName,
          phone: debt.customerPhone,
          amount: 0,
          debts: 0,
          overdue: 0,
          maxDaysOverdue: 0,
          dueToday: 0,
          nextDueDate: debt.dueDate,
          avatar: debt.customerName.slice(0, 2).toUpperCase(),
        };

        current.amount += debt.outstandingAmount;
        current.debts += 1;
        current.overdue += debt.isOverdue ? 1 : 0;
        current.maxDaysOverdue = Math.max(current.maxDaysOverdue, debt.daysOverdue);
        current.dueToday += !debt.isOverdue && debt.daysUntilDue === 0 ? 1 : 0;
        current.nextDueDate = current.nextDueDate && current.nextDueDate < debt.dueDate ? current.nextDueDate : debt.dueDate;
        grouped.set(debt.customerId, current);
      });

    return Array.from(grouped.values())
      .filter((debtor) => debtor.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.overdue - a.overdue || b.amount - a.amount);
  }, [currentFilter, debts, search]);
  const selectedDebtors = useMemo(
    () => debtors.filter((debtor) => selectedDebtorIds.has(debtor.id)),
    [debtors, selectedDebtorIds],
  );
  const allVisibleSelected = debtors.length > 0 && selectedDebtors.length === debtors.length;

  useEffect(() => {
    setSelectedDebtorIds((current) => {
      const visibleIds = new Set(debtors.map((debtor) => debtor.id));
      const next = new Set(Array.from(current).filter((id) => visibleIds.has(id)));

      return next.size === current.size ? current : next;
    });
  }, [debtors]);

  function toggleDebtorSelection(debtorId: string) {
    setSelectedDebtorIds((current) => {
      const next = new Set(current);

      if (next.has(debtorId)) {
        next.delete(debtorId);
      } else {
        next.add(debtorId);
      }

      return next;
    });
  }

  function clearSelection() {
    setSelectedDebtorIds(new Set());
  }

  function toggleVisibleSelection() {
    if (allVisibleSelected) {
      clearSelection();
      return;
    }

    setSelectedDebtorIds(new Set(debtors.map((debtor) => debtor.id)));
  }

  return (
    <div className="p-5 pb-28 space-y-5 page-transition">
      <MobileHeader
        title="Devedores"
        fallbackHref="/"
        action={
          <Link
            href="/new-debt"
            className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center btn-press hover:bg-gray-200 transition-colors"
            aria-label="Nova divida"
          >
            <UserPlus size={20} strokeWidth={1.8} />
          </Link>
        }
      />

      <div className="relative animate-emerge">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          type="text"
          placeholder="Buscar por nome..."
          className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm placeholder:text-gray-300 transition-all"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white text-gray-400 flex items-center justify-center shadow-ios"
            aria-label="Limpar busca"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 p-1 bg-gray-50 rounded-xl animate-emerge stagger-1">
        {filterOptions.map((option) => (
          <Link
            key={option.value}
            href={`/debtors?filter=${option.value}`}
            className={`py-2 rounded-lg text-xs font-semibold text-center transition ${
              currentFilter === option.value ? "bg-white text-gray-950 shadow-ios" : "text-gray-400"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {!loading && debtors.length > 0 && (
        <div className="card rounded-[14px] p-3 flex items-center justify-between gap-3 animate-emerge stagger-2">
          <button
            type="button"
            onClick={toggleVisibleSelection}
            className="flex items-center gap-2 text-xs font-semibold text-gray-600"
          >
            {allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            {allVisibleSelected ? "Limpar seleção" : "Selecionar visíveis"}
          </button>

          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            disabled={selectedDebtors.length === 0}
            className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
          >
            <MessageCircle size={14} />
            Cobrar {selectedDebtors.length}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem />
        </div>
      ) : debtors.length === 0 ? (
        <div className="card rounded-[14px] p-6 text-center">
          <p className="font-semibold text-gray-900">Nenhum resultado neste filtro</p>
          <p className="text-sm text-gray-400 mt-1">Tente outro filtro ou busque por outro nome.</p>
        </div>
      ) : (
        <div className="space-y-2 stagger-fade">
          {debtors.map((debtor) => (
            <div key={debtor.id} className="card rounded-[14px] p-4 flex items-center gap-3 btn-press">
              <button
                type="button"
                onClick={() => toggleDebtorSelection(debtor.id)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedDebtorIds.has(debtor.id) ? "bg-ios-soft-blue text-ios-blue" : "bg-gray-50 text-gray-300"
                }`}
                aria-label={selectedDebtorIds.has(debtor.id) ? `Remover ${debtor.name} do lote` : `Adicionar ${debtor.name} ao lote`}
              >
                {selectedDebtorIds.has(debtor.id) ? <CheckSquare size={17} /> : <Square size={17} />}
              </button>
              <Link href={`/debtors/${debtor.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-medium text-xs border border-gray-200">
                  {debtor.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-gray-900 truncate">{debtor.name}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {debtor.debts} divida{debtor.debts > 1 ? "s" : ""} em aberto
                  </p>
                  {(debtor.overdue > 0 || debtor.dueToday > 0) && (
                    <p className={`text-[11px] font-semibold mt-1 ${debtor.overdue > 0 ? "text-red-500" : "text-blue-500"}`}>
                      {debtor.overdue > 0
                        ? `${debtor.overdue} atrasada${debtor.overdue === 1 ? "" : "s"}`
                        : `${debtor.dueToday} vence${debtor.dueToday === 1 ? "" : "m"} hoje`}
                    </p>
                  )}
                </div>
              </Link>
              <div className="text-right flex flex-col items-end gap-2">
                <p className="font-semibold text-sm text-gray-900">{formatCurrency(debtor.amount)}</p>
                <div className="flex gap-1.5">
                  <ChargeMessageButton
                    amount={debtor.amount}
                    customerId={debtor.id}
                    daysOverdue={debtor.maxDaysOverdue}
                    debtorName={debtor.name}
                    debtsCount={debtor.debts}
                    defaultTone={debtor.overdue > 0 ? "overdue" : "friendly"}
                    iconSize={14}
                    phone={debtor.phone}
                    pixKey={profile?.pixKey}
                    userId={user?.id}
                    className="w-7 h-7 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 transition-colors"
                  />
                  <Link
                    href={`/debtors/${debtor.id}`}
                    className="w-7 h-7 rounded-lg bg-gray-50 text-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                    aria-label={`Ver detalhes de ${debtor.name}`}
                  >
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {bulkOpen && selectedDebtors.length > 0 && (
        <BulkChargeModal
          debtors={selectedDebtors}
          onClose={() => setBulkOpen(false)}
          onDone={() => {
            setBulkOpen(false);
            clearSelection();
          }}
          pixKey={profile?.pixKey}
          userId={user?.id}
        />
      )}
    </div>
  );
}

function BulkChargeModal({
  debtors,
  onClose,
  onDone,
  pixKey,
  userId,
}: {
  debtors: DebtorListItem[];
  onClose: () => void;
  onDone: () => void;
  pixKey?: string;
  userId?: string;
}) {
  const [index, setIndex] = useState(0);
  const activeIndex = Math.min(index, Math.max(debtors.length - 1, 0));
  const activeDebtor = debtors[activeIndex];
  const [tone, setTone] = useState<MessageTone>("friendly");
  const generatedMessage = useMemo(
    () =>
      buildChargeMessage({
        amount: activeDebtor?.amount || 0,
        daysOverdue: activeDebtor?.maxDaysOverdue || 0,
        debtorName: activeDebtor?.name || "",
        debtsCount: activeDebtor?.debts || 0,
        dueDate: activeDebtor?.nextDueDate,
        pixKey,
        tone,
      }),
    [activeDebtor?.amount, activeDebtor?.debts, activeDebtor?.maxDaysOverdue, activeDebtor?.name, activeDebtor?.nextDueDate, pixKey, tone],
  );
  const [messageText, setMessageText] = useState(generatedMessage);
  const [copied, setCopied] = useState(false);
  const canUseMessage = messageText.trim().length > 0;
  const isLast = activeIndex >= debtors.length - 1;

  useEffect(() => {
    setTone(activeDebtor?.overdue ? "overdue" : "friendly");
  }, [activeDebtor?.id, activeDebtor?.overdue]);

  useEffect(() => {
    setMessageText(generatedMessage);
    setCopied(false);
  }, [generatedMessage]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function logCharge(action: "copied" | "sent") {
    if (!activeDebtor || !userId) return;

    try {
      await recordChargeLog(userId, {
        action,
        customerId: activeDebtor.id,
        customerName: activeDebtor.name,
        message: messageText,
        tone,
      });
    } catch {
      // O envio manual pelo WhatsApp não deve depender do histórico.
    }
  }

  async function handleCopy() {
    if (!canUseMessage) return;

    await navigator.clipboard.writeText(messageText);
    await logCharge("copied");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function handleSend() {
    if (!activeDebtor || !canUseMessage) return;

    window.open(buildWhatsappUrl(activeDebtor.phone, messageText), "_blank", "noopener,noreferrer");
    void logCharge("sent");
  }

  function handleNext() {
    if (isLast) {
      onDone();
      return;
    }

    setIndex((current) => Math.min(current + 1, debtors.length - 1));
  }

  if (!activeDebtor || typeof document === "undefined") return null;

  return createPortal(
    <div className="app-modal z-[100]">
      <button type="button" aria-label="Fechar cobrança em lote" className="app-modal__backdrop" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cobrança em lote"
        className="app-modal__panel relative w-full max-w-lg bg-white rounded-[1.4rem] p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
              {activeIndex + 1} de {debtors.length}
            </p>
            <h2 className="text-lg font-semibold text-gray-950 mt-0.5">{activeDebtor.name}</h2>
            <p className="text-xs text-gray-400 mt-1">
              {formatCurrency(activeDebtor.amount)} · {activeDebtor.debts} cobrança{activeDebtor.debts === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 bg-gray-50 rounded-xl">
          {bulkToneOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTone(option.value)}
              className={`py-2 rounded-lg text-xs font-semibold transition ${
                tone === option.value ? "bg-white text-gray-950 shadow-ios" : "text-gray-400"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <EditableMessageBox value={messageText} onChange={setMessageText} rows={7} />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!canUseMessage}
            className="p-3 rounded-xl bg-gray-900 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Copy size={16} />
            {copied ? "Copiada" : "Copiar"}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canUseMessage}
            className="p-3 rounded-xl bg-green-500 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send size={16} />
            WhatsApp
          </button>
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="w-full p-3 rounded-xl bg-gray-50 text-gray-700 font-semibold text-sm btn-press"
        >
          {isLast ? "Concluir lote" : "Próximo devedor"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function getFilter(value: string | null): DebtorFilter {
  if (value === "overdue" || value === "due-today" || value === "open") return value;

  return "open";
}
