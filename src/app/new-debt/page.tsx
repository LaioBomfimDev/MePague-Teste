"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Camera } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewDebtPage() {
    const [step, setStep] = useState(1);
    const router = useRouter();

    const handleNext = () => setStep(step + 1);
    const handleBack = () => step > 1 ? setStep(step - 1) : router.back();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col page-transition">
            {/* Header */}
            <header className="p-4 flex items-center justify-between">
                <button onClick={handleBack} className="p-2 -ml-2">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="font-bold text-lg">Nova Dívida</h1>
                <div className="w-10" />
            </header>

            {/* Progress */}
            <div className="px-6 flex gap-2">
                <div className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-emerald-600" : "bg-gray-200"}`} />
                <div className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-emerald-600" : "bg-gray-200"}`} />
            </div>

            <div className="flex-1 p-6">
                {step === 1 && (
                    <div className="space-y-6 animate-fadeIn">
                        <div>
                            <h2 className="text-2xl font-bold">Quem deve?</h2>
                            <p className="text-gray-500">Selecione ou cadastre um novo devedor.</p>
                        </div>

                        <div className="flex flex-col items-center gap-4 py-4">
                            <div className="w-24 h-24 rounded-3xl bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 gap-1 active:bg-gray-200 transition-colors">
                                <Camera size={24} />
                                <span className="text-[10px] font-bold uppercase">Foto</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Nome Completo</label>
                                <input type="text" placeholder="Ex: João da Silva" className="w-full p-4 bg-white border rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1">WhatsApp / Telefone</label>
                                <input type="tel" placeholder="(00) 00000-0000" className="w-full p-4 bg-white border rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-fadeIn">
                        <div>
                            <h2 className="text-2xl font-bold">Quanto deve?</h2>
                            <p className="text-gray-500">Detalhes do valor e prazo de pagamento.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Valor Total (R$)</label>
                                <input type="number" placeholder="0,00" className="w-full p-6 text-3xl font-bold bg-white border rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Data de Vencimento</label>
                                <input type="date" className="w-full p-4 bg-white border rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                            </div>

                            <div className="space-y-4 pt-2">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Juros por dia de atraso</label>
                                    <span className="text-emerald-700 font-bold">1.5%</span>
                                </div>
                                <input type="range" min="0" max="5" step="0.5" className="w-full accent-emerald-600" />
                                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                    <p className="text-[10px] text-blue-700 font-bold uppercase mb-1">Preview de Juros</p>
                                    <p className="text-xs text-blue-600">A cada 10 dias de atraso, o valor aumenta <span className="font-bold">R$ 22,50</span>.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Button */}
            <footer className="p-6">
                {step === 2 ? (
                    <button onClick={() => router.push("/")} className="w-full p-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-emerald-600/20">
                        <Check size={20} />
                        Salvar Dívida
                    </button>
                ) : (
                    <button onClick={handleNext} className="w-full p-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                        Próximo
                        <ArrowRight size={20} />
                    </button>
                )}
            </footer>
        </div>
    );
}
