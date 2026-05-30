"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import Image from "next/image";
import { useAuth } from "@/components/AuthProvider";
import { subscribeUserProfile } from "@/lib/database";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const isLoginPage = pathname === "/login";
  const isAdminPage = pathname.startsWith("/admin");
  const hideBottomNav = isLoginPage || pathname === "/new-debt" || isAdminPage || isSuperAdmin;

  useEffect(() => {
    if (!user) {
      setIsSuperAdmin(false);
      setProfileLoaded(true);
      return;
    }

    setProfileLoaded(false);
    return subscribeUserProfile(user.id, (profile) => {
      setIsSuperAdmin(profile?.role === "superadmin" && profile.status === "active");
      setProfileLoaded(true);
    });
  }, [user]);

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace("/login");
    }

    if (!loading && user && profileLoaded && isSuperAdmin && !isAdminPage) {
      router.replace("/admin");
      return;
    }

    if (!loading && user && profileLoaded && !isSuperAdmin && isAdminPage) {
      router.replace("/");
      return;
    }

    if (!loading && user && profileLoaded && isLoginPage) {
      router.replace("/");
    }
  }, [isAdminPage, isLoginPage, isSuperAdmin, loading, profileLoaded, router, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Image src="/logo.jpeg" alt="Carregando" width={100} height={100} className="rounded-3xl shadow-ios animate-pulse" />
      </div>
    );
  }

  if (!user && !isLoginPage) {
    return null;
  }

  return (
    <>
      <main className="min-h-screen pb-safe relative">
        <div className={isAdminPage ? "min-h-screen bg-gray-50" : "max-w-lg mx-auto bg-white min-h-screen"}>{children}</div>
      </main>
      {!hideBottomNav && <BottomNav />}
    </>
  );
}
