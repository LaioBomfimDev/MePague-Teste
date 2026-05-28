"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/components/AuthProvider";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === "/login";
  const hideBottomNav = isLoginPage || pathname === "/new-debt";

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace("/login");
    }

    if (!loading && user && isLoginPage) {
      router.replace("/");
    }
  }, [isLoginPage, loading, router, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm font-medium text-ios-gray">
        Carregando...
      </div>
    );
  }

  if (!user && !isLoginPage) {
    return null;
  }

  return (
    <>
      <main className="min-h-screen pb-safe relative">
        <div className="max-w-lg mx-auto bg-white min-h-screen">{children}</div>
      </main>
      {!hideBottomNav && <BottomNav />}
    </>
  );
}
