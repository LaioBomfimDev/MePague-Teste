"use client";

import { Plus, AlertCircle, TrendingUp, Wallet } from "lucide-react";

export default function Dashboard() {
  const stats = [
    { label: "Total a Receber", value: "R$ 1.250,00", icon: Wallet, color: "text-emerald-600" },
    { label: "Vencidos", value: "R$ 450,00", icon: AlertCircle, color: "text-red-500" },
    { label: "Este Mês", value: "R$ 800,00", icon: TrendingUp, color: "text-blue-500" },
  ];

  return (
    <div className="p-4 space-y-6 page-transition">
      {/* Header */}
      <header className="flex justify-between items-center py-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Me Pague</h1>
          <p className="text-gray-500 text-sm">Olá, bom dia! 💸</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold border border-emerald-200">
          M
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4">
        <div className="glass p-6 rounded-3xl space-y-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Wallet size={80} />
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-gray-500">Saldo Total Pendente</p>
            <h2 className="text-4xl font-bold tracking-tight mt-1">R$ 1.250,50</h2>
            <div className="flex items-center gap-2 mt-4">
              <span className="px-2 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold uppercase">
                5 Dívidas Vencidas
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {stats.slice(1).map((stat) => (
            <div key={stat.label} className="glass p-4 rounded-3xl space-y-1">
              <stat.icon size={20} className={stat.color} />
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              <p className="font-bold text-lg">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions / Critical Debts */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">Urgentes</h3>
          <button className="text-emerald-600 text-sm font-bold">Ver tudo</button>
        </div>

        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="glass p-4 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-200" />
              <div className="flex-1">
                <h4 className="font-bold text-sm">João da Silva</h4>
                <p className="text-xs text-red-500">Venceu há 3 dias</p>
              </div>
              <div className="text-right">
                <p className="font-bold">R$ 150,00</p>
                <button className="text-[10px] font-bold text-emerald-600 uppercase mt-1">Cobrar</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Floating Action Button */}
      <button className="fixed right-6 bottom-24 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform">
        <Plus size={32} />
      </button>
    </div>
  );
}
