"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import ThemeSelector from "@/components/ThemeSelector";

type MobileHeaderProps = {
  action?: ReactNode;
  fallbackHref?: string;
  showBack?: boolean;
  subtitle?: string;
  title: string;
};

export default function MobileHeader({
  action,
  fallbackHref = "/",
  showBack = true,
  subtitle,
  title,
}: MobileHeaderProps) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <header className="sticky top-0 z-30 -mx-5 px-5 pt-3 pb-3 bg-white/95 backdrop-blur border-b border-transparent page-header-enter">
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            className="w-10 h-10 shrink-0 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center btn-press hover:bg-gray-200 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
        ) : (
          <div className="w-10 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2">
          {action}
          <ThemeSelector />
        </div>
      </div>
    </header>
  );
}
