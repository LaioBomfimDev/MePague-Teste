"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, PieChart, ShieldCheck, User, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeUserProfile } from "@/lib/database";
import { cn } from "@/lib/utils";

const baseTabs = [
  { name: "Início", href: "/", icon: Home },
  { name: "Devedores", href: "/debtors", icon: Users },
  { name: "Finanças", href: "/reports", icon: PieChart },
  { name: "Ajustes", href: "/profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsSuperAdmin(false);
      return;
    }

    return subscribeUserProfile(user.id, (profile) => {
      setIsSuperAdmin(profile?.role === "superadmin" && profile.status === "active");
    });
  }, [user]);

  const tabs = isSuperAdmin
    ? [...baseTabs.slice(0, 3), { name: "Admin", href: "/admin", icon: ShieldCheck }, baseTabs[3]]
    : baseTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 ios-glass border-t border-black/[0.05] pb-safe z-50">
      <div className="flex justify-around items-center h-[60px] max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-all duration-300",
                isActive
                  ? "text-ios-blue"
                  : "text-ios-gray hover:text-black"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all duration-300",
                isActive && "bg-ios-blue/10"
              )}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[10px] font-medium tracking-tight",
                isActive ? "opacity-100" : "opacity-70"
              )}>
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
