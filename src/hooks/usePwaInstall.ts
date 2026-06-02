"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const PROMPT_DISMISSED_KEY = "me-pague:pwa-prompt-dismissed";

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Carrega se já foi descartado nesta sessão/login
    try {
      setPromptDismissed(window.localStorage.getItem(PROMPT_DISMISSED_KEY) === "true");
    } catch {
      setPromptDismissed(false);
    }

    // Detecta se é iOS e não está em standalone
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      setIsIOS(Boolean(isApple && !isStandalone));
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      // Previne o banner padrão automático do navegador
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      
      if (choiceResult.outcome === "accepted") {
        return true;
      }
      return false;
    } catch (error) {
      console.error("Erro ao solicitar instalação do PWA:", error);
      return false;
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(PROMPT_DISMISSED_KEY, "true");
    } catch {}
    setPromptDismissed(true);
  }, []);

  return useMemo(
    () => ({
      supported: Boolean(deferredPrompt || isIOS),
      isIOS,
      promptDismissed,
      install,
      dismiss,
    }),
    [deferredPrompt, isIOS, promptDismissed, install, dismiss]
  );
}
