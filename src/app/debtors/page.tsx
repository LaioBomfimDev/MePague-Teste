"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Search, UserPlus, X } from "lucide-react";
import ChargeMessageButton from "@/components/ChargeMessageButton";
import MobileHeader from "@/components/MobileHeader";
import { SkeletonListItem } from "@/components/Skeleton";
import { useAppData } from "@/hooks/useAppData";
import { formatCurrency } from "@/lib/format";

type DebtorFilter = "open" | "overdue" | "due-today";

const filterOptions: Array<{ value: DebtorFilter; label: string }> = [
  { value: "open", label: "Em aberto" },
  { value: "overdue", label: "Atrasadas" },
  { value: "due-today", label: "Vence hoje" },
];

export default function DebtorsPage() {
  const { debts, loading, profile, user } = useAppData();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const currentFilter = getFilter(searchParams.get("filter"));

  const debtors = useMemo(() => {
    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        phone: string;
        amount: number;
        debts: number;
        overdue: number;
        maxDaysOverdue: number;
        dueToday: number;
        avatar: string;
      }
    >();

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
          avatar: debt.customerName.slice(0, 2).toUpperCase(),
        };

        current.amount += debt.outstandingAmount;
        current.debts += 1;
        current.overdue += debt.isOverdue ? 1 : 0;
        current.maxDaysOverdue = Math.max(current.maxDaysOverdue, debt.daysOverdue);
        current.dueToday += !debt.isOverdue && debt.daysUntilDue === 0 ? 1 : 0;
        grouped.set(debt.customerId, current);
      });

    return Array.from(grouped.values())
      .filter((debtor) => debtor.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.overdue - a.overdue || b.amount - a.amount);
  }, [currentFilter, debts, search]);

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
    </div>
  );
}

function getFilter(value: string | null): DebtorFilter {
  if (value === "overdue" || value === "due-today" || value === "open") return value;

  return "open";
}
