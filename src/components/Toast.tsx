"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

type ToastProps = {
  message: string;
  tone?: "success" | "info" | "error";
};

export default function Toast({ message, tone = "success" }: ToastProps) {
  if (!message) return null;

  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  const toneClass =
    tone === "error"
      ? "bg-red-500 text-white"
      : tone === "info"
        ? "bg-gray-900 text-white"
        : "bg-green-500 text-white";

  return (
    <div className="fixed left-1/2 top-4 z-[120] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 toast-enter">
      <div className={`mx-auto flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl ${toneClass}`}>
        <Icon size={18} strokeWidth={2.3} />
        <span className="min-w-0 flex-1">{message}</span>
      </div>
    </div>
  );
}
