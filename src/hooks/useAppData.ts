"use client";

import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeAppData, type AppDataSnapshot } from "@/lib/database";
import { enhanceDebt } from "@/lib/format";
import type { DashboardStats, DebtWithCustomer } from "@/lib/types";

type AppDataContextValue = Omit<AppDataSnapshot, "debts"> & {
  debts: DebtWithCustomer[];
  error: string | null;
  loading: boolean;
  stats: DashboardStats;
  user: ReturnType<typeof useAuth>["user"];
};

const emptyData: AppDataSnapshot = {
  profile: null,
  customers: [],
  debts: [],
  payments: [],
  chargeLogs: [],
};

const emptyStats: DashboardStats = {
  totalOpen: 0,
  totalOriginalOpen: 0,
  totalOverdue: 0,
  totalPaid: 0,
  forecast7Days: 0,
  forecast30Days: 0,
  dueTodayCount: 0,
  dueSoonCount: 0,
  overdueCount: 0,
  openCount: 0,
  paidCount: 0,
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<AppDataSnapshot>(emptyData);
  const [dataUserId, setDataUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setData(emptyData);
      setDataUserId(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    return subscribeAppData(
      user.id,
      (snapshot) => {
        setData(snapshot);
        setDataUserId(user.id);
        setLoading(false);
      },
      () => {
        setError("Nao foi possivel sincronizar os dados agora.");
        setLoading(false);
      },
    );
  }, [user]);

  const enhancedDebts = useMemo(
    () => data.debts.map((debt) => enhanceDebt(debt, data.payments, data.chargeLogs)),
    [data.chargeLogs, data.debts, data.payments],
  );

  const isLoading = loading || Boolean(user && dataUserId !== user.id);

  const stats = useMemo<DashboardStats>(() => {
    return enhancedDebts.reduce(
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
      { ...emptyStats },
    );
  }, [enhancedDebts]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      ...data,
      debts: enhancedDebts,
      error,
      loading: isLoading,
      stats,
      user,
    }),
    [data, enhancedDebts, error, isLoading, stats, user],
  );

  return createElement(AppDataContext.Provider, { value }, children);
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error("useAppData must be used inside AppDataProvider");
  }

  return context;
}
