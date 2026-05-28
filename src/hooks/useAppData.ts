"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  subscribeChargeLogs,
  subscribeCustomers,
  subscribeDebts,
  subscribePayments,
  subscribeUserProfile,
} from "@/lib/database";
import { enhanceDebt } from "@/lib/format";
import type { ChargeLog, Customer, DashboardStats, Debt, Payment, UserProfile } from "@/lib/types";

export function useAppData() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [chargeLogs, setChargeLogs] = useState<ChargeLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setCustomers([]);
      setDebts([]);
      setPayments([]);
      setChargeLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribeProfile = subscribeUserProfile(user.id, setProfile);
    const unsubscribeCustomers = subscribeCustomers(user.id, setCustomers);
    const unsubscribePayments = subscribePayments(user.id, setPayments);
    const unsubscribeChargeLogs = subscribeChargeLogs(user.id, setChargeLogs);
    const unsubscribeDebts = subscribeDebts(user.id, (nextDebts) => {
      setDebts(nextDebts);
      setLoading(false);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeCustomers();
      unsubscribePayments();
      unsubscribeChargeLogs();
      unsubscribeDebts();
    };
  }, [user]);

  const enhancedDebts = useMemo(
    () => debts.map((debt) => enhanceDebt(debt, payments, chargeLogs)),
    [chargeLogs, debts, payments],
  );

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
      {
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
      },
    );
  }, [enhancedDebts]);

  return {
    customers,
    chargeLogs,
    debts: enhancedDebts,
    loading,
    payments,
    profile,
    stats,
    user,
  };
}
