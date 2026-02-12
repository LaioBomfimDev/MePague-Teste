"use client";

import { Search, UserPlus, MessageCircle, ChevronRight } from "lucide-react";

export default function DebtorsPage() {
    return (
        <div className="p-4 space-y-6 page-transition">
            <header className="flex justify-between items-center py-2">
                <h1 className="text-2xl font-bold tracking-tight">Devedores</h1>
                <button className="bg-emerald-100 text-emerald-700 p-2 rounded-xl active:scale-95 transition-transform">
                    <UserPlus size={24} />
                </button>
            </header>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="Buscar por nome..."
                    className="w-full pl-10 pr-4 py-3 glass rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
            </div>

            {/* Debtors List */}
            <div className="space-y-4">
                {[
                    { name: "João da Silva", amount: "R$ 150,00", debts: 1, avatar: "JS" },
                    { name: "Maria Oliveira", amount: "R$ 450,00", debts: 3, avatar: "MO" },
                    { name: "Carlos Souza", amount: "R$ 30,00", debts: 1, avatar: "CS" },
                    { name: "Ana Beatriz", amount: "R$ 0,00", debts: 0, avatar: "AB" },
                ].map((debtor) => (
                    <div key={debtor.name} className="glass p-4 rounded-3xl flex items-center gap-4 active:bg-white/50 transition-colors">
                        <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary font-bold text-lg border border-secondary/20">
                            {debtor.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-base truncate">{debtor.name}</h4>
                            <p className="text-xs text-gray-500">
                                {debtor.debts > 0 ? `${debtor.debts} dívidas em aberto` : "Sem dívidas"}
                            </p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                            <p className={debtor.amount !== "R$ 0,00" ? "font-bold text-sm" : "text-gray-400 text-sm"}>
                                {debtor.amount}
                            </p>
                            <div className="flex gap-2">
                                <button className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                    <MessageCircle size={16} />
                                </button>
                                <button className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
