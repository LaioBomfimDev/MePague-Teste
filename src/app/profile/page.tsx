"use client";

import { User, Shield, Bell, CreditCard, LogOut, ChevronRight, Fingerprint } from "lucide-react";

export default function ProfilePage() {
    const sections = [
        { title: "Minhas Chaves Pix", icon: CreditCard, color: "text-blue-500" },
        { title: "Notificações", icon: Bell, color: "text-orange-500" },
        { title: "Segurança & Biometria", icon: Shield, color: "text-purple-500" },
    ];

    return (
        <div className="p-4 space-y-6 page-transition">
            <header className="py-2">
                <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
            </header>

            {/* Profile Card */}
            <div className="glass p-6 rounded-3xl flex flex-col items-center text-center space-y-3 shadow-sm border-emerald-100">
                <div className="w-24 h-24 rounded-full bg-emerald-600 text-white flex items-center justify-center text-3xl font-bold border-4 border-white shadow-xl">
                    M
                </div>
                <div>
                    <h2 className="text-xl font-bold">Meu Perfil</h2>
                    <p className="text-gray-500 text-sm">membro desde Fev 2024</p>
                </div>
            </div>

            {/* Settings List */}
            <div className="space-y-3">
                {sections.map((item) => (
                    <button key={item.title} className="w-full glass p-4 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-all">
                        <div className="flex items-center gap-4">
                            <div className={`p-2 bg-white rounded-xl shadow-sm ${item.color}`}>
                                <item.icon size={20} />
                            </div>
                            <span className="font-bold text-sm">{item.title}</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-300" />
                    </button>
                ))}
            </div>

            {/* Biometry Toggle (Visual) */}
            <div className="glass p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-white rounded-xl shadow-sm text-emerald-600">
                        <Fingerprint size={20} />
                    </div>
                    <div>
                        <p className="font-bold text-sm">Entrada com Digital</p>
                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Ativado</p>
                    </div>
                </div>
                <div className="w-12 h-6 bg-emerald-600 rounded-full relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                </div>
            </div>

            <button className="w-full p-4 text-red-500 font-bold flex items-center justify-center gap-2 mt-4">
                <LogOut size={20} />
                Sair da Conta
            </button>
        </div>
    );
}
