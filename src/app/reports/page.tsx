"use client";

import { BarChart3, Download, Share2, TrendingDown, TrendingUp } from "lucide-react";

export default function ReportsPage() {
    return (
        <div className="p-4 space-y-6 page-transition">
            <header className="flex justify-between items-center py-2">
                <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
                <button className="bg-emerald-100 text-emerald-700 p-2 rounded-xl active:scale-95 transition-transform">
                    <Download size={24} />
                </button>
            </header>

            {/* Summary Chart Placeholder */}
            <div className="glass p-6 rounded-3xl space-y-6">
                <div className="flex justify-between items-end h-40 gap-2">
                    {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                            <div
                                className={`w-full rounded-t-lg transition-all duration-500 ${i === 3 ? "bg-emerald-500" : "bg-emerald-200"}`}
                                style={{ height: `${h}%` }}
                            />
                            <span className="text-[10px] text-gray-400 font-bold uppercase">S{i + 1}</span>
                        </div>
                    ))}
                </div>
                <div className="pt-4 border-t border-dashed flex justify-between items-center">
                    <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Média Semanal</p>
                        <p className="text-xl font-bold">R$ 420,00</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-emerald-600 font-bold">+12% vs mês anterior</p>
                    </div>
                </div>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-1 gap-4">
                <div className="glass p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Recebido (Mês)</p>
                            <p className="font-bold">R$ 2.400,00</p>
                        </div>
                    </div>
                    <Share2 size={18} className="text-gray-400" />
                </div>

                <div className="glass p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                            <TrendingDown size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Pendente total</p>
                            <p className="font-bold">R$ 1.250,50</p>
                        </div>
                    </div>
                    <Share2 size={18} className="text-gray-400" />
                </div>
            </div>

            <button className="w-full p-4 glass border-emerald-200 text-emerald-700 rounded-2xl font-bold flex items-center justify-center gap-2">
                <Download size={20} />
                Exportar PDF Detalhado
            </button>
        </div>
    );
}
