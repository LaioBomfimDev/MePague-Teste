"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, PieChart, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
    { name: "Início", href: "/", icon: Home },
    { name: "Devedores", href: "/debtors", icon: Users },
    { name: "Relatórios", href: "/reports", icon: PieChart },
    { name: "Perfil", href: "/profile", icon: User },
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 glass border-t pb-safe z-50">
            <div className="flex justify-around items-center h-16">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href;
                    const Icon = tab.icon;

                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                                isActive ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            <Icon size={24} className={cn(isActive && "animate-pulse")} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">
                                {tab.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
