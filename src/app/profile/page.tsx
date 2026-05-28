"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, ChevronRight, CreditCard, Fingerprint, LogOut, Save, Shield } from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import { SkeletonListItem } from "@/components/Skeleton";
import Toast from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { useAppData } from "@/hooks/useAppData";
import { updateUserProfile } from "@/lib/database";

export default function ProfilePage() {
  const { logout, user } = useAuth();
  const { loading, profile } = useAppData();
  const [name, setName] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderWindow, setReminderWindow] = useState(1);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "info" | "error">("success");
  const [savedPulse, setSavedPulse] = useState(false);
  const [saving, setSaving] = useState(false);
  const pixInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(profile?.name || "");
    setPixKey(profile?.pixKey || "");
  }, [profile]);

  useEffect(() => {
    const savedEnabled = window.localStorage.getItem("me-pague:notifications-enabled");
    const savedWindow = window.localStorage.getItem("me-pague:reminder-window");

    if (savedEnabled) {
      setNotificationsEnabled(savedEnabled === "true");
    }

    if (savedWindow) {
      setReminderWindow(Number(savedWindow));
    }
  }, []);

  const sections = [
    { title: "Minhas Chaves Pix", icon: CreditCard, color: "text-blue-500", bg: "bg-blue-50" },
    { title: "Seguranca & Biometria", icon: Shield, color: "text-purple-500", bg: "bg-purple-50" },
  ];

  async function handleSave() {
    if (!user) return;

    setSaving(true);
    setNotice("");

    try {
      await updateUserProfile(user.id, { name, pixKey });
      setNoticeTone("success");
      setNotice("Perfil salvo com sucesso.");
      setSavedPulse(true);
      window.setTimeout(() => setSavedPulse(false), 520);
      window.setTimeout(() => setNotice(""), 2400);
    } catch {
      setNoticeTone("error");
      setNotice("Nao foi possivel salvar agora.");
      window.setTimeout(() => setNotice(""), 2600);
    } finally {
      setSaving(false);
    }
  }

  function handleNotificationsChange(enabled: boolean) {
    setNotificationsEnabled(enabled);
    window.localStorage.setItem("me-pague:notifications-enabled", String(enabled));
  }

  function handleReminderWindowChange(value: number) {
    setReminderWindow(value);
    window.localStorage.setItem("me-pague:reminder-window", String(value));
  }

  function handleProfileShortcut(title: string) {
    if (title === "Minhas Chaves Pix") {
      pixInputRef.current?.focus();
      pixInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setNoticeTone("info");
      setNotice("Chave Pix selecionada.");
      window.setTimeout(() => setNotice(""), 1800);
      return;
    }

    setNoticeTone("info");
    setNotice("Biometria ainda depende do dispositivo. Por enquanto, use email/senha ou o login de teste.");
    window.setTimeout(() => setNotice(""), 2600);
  }

  return (
    <div className="p-5 pb-28 space-y-6 page-transition">
      <Toast message={notice} tone={noticeTone} />
      <MobileHeader title="Meu Perfil" fallbackHref="/" />

      {loading ? (
        <div className="space-y-4">
          <div className="card rounded-[18px] p-6 flex flex-col items-center space-y-3">
            <div className="skeleton w-20 h-20 rounded-full" />
            <div className="skeleton h-5 w-24 rounded-md" />
            <div className="skeleton h-3 w-32 rounded-md" />
          </div>
          <SkeletonListItem />
          <SkeletonListItem />
        </div>
      ) : (
        <>
          <div className="card rounded-[18px] p-6 flex flex-col items-center text-center space-y-3">
            <div
              className="w-20 h-20 rounded-full bg-gray-900 text-white flex items-center justify-center text-2xl font-semibold border-4 border-white"
              style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
            >
              {name?.[0]?.toUpperCase() || "M"}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{name || "Meu Perfil"}</h2>
              <p className="text-gray-400 text-xs mt-0.5">{profile?.plan === "pro" ? "Plano Pro" : "Plano gratis"}</p>
            </div>
          </div>

          <div className={`card rounded-[14px] p-4 space-y-3 ${savedPulse ? "success-pulse" : ""}`}>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nome</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full mt-1 p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Chave Pix</label>
              <input
                ref={pixInputRef}
                value={pixKey}
                onChange={(event) => setPixKey(event.target.value)}
                placeholder="CPF, celular, email ou chave aleatoria"
                className="w-full mt-1 p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm placeholder:text-gray-300"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`w-full p-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 btn-press ${
                savedPulse ? "bg-green-500 text-white" : "bg-gray-900 text-white"
              }`}
            >
              <Save size={16} />
              {saving ? "Salvando..." : savedPulse ? "Salvo" : "Salvar perfil"}
            </button>
          </div>

          <div className="space-y-2 stagger-fade">
            {sections.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => handleProfileShortcut(item.title)}
                className="w-full card rounded-[14px] p-4 flex items-center justify-between btn-press"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center ${item.color}`}>
                    <item.icon size={18} strokeWidth={1.8} />
                  </div>
                  <span className="font-medium text-sm text-gray-900">{item.title}</span>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ))}
          </div>

          <div className="card rounded-[14px] p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-400 flex items-center justify-center">
                  <Bell size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">Lembretes de cobranca</p>
                  <p className="text-xs text-gray-400 mt-0.5">Destaca vencimentos no inicio do app.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleNotificationsChange(!notificationsEnabled)}
                className={`w-11 h-6 rounded-full relative transition-colors ${notificationsEnabled ? "bg-green-500" : "bg-gray-200"}`}
                aria-pressed={notificationsEnabled}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${notificationsEnabled ? "translate-x-5" : "translate-x-0.5"}`}
                  style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
                />
              </button>
            </div>

            <div className={notificationsEnabled ? "space-y-3" : "space-y-3 opacity-50"}>
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Avisar antes</label>
                <span className="text-sm font-semibold text-gray-900">
                  {reminderWindow} dia{reminderWindow === 1 ? "" : "s"}
                </span>
              </div>
              <input
                value={reminderWindow}
                onChange={(event) => handleReminderWindowChange(Number(event.target.value))}
                disabled={!notificationsEnabled}
                type="range"
                min="0"
                max="7"
                step="1"
                className="w-full accent-gray-900 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="card rounded-[14px] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-green-500">
                <Fingerprint size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">Entrada com Digital</p>
                <p className="text-[10px] text-green-500 font-medium uppercase tracking-wider mt-0.5">Em breve</p>
              </div>
            </div>
            <div className="w-11 h-6 bg-gray-200 rounded-full relative">
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full p-4 text-red-400 font-medium text-sm flex items-center justify-center gap-2 mt-4 hover:text-red-500 transition-colors"
          >
            <LogOut size={18} strokeWidth={1.8} />
            Sair da Conta
          </button>
        </>
      )}
    </div>
  );
}
