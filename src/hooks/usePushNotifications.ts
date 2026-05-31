"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { DEMO_USER_ID } from "@/lib/database";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushSupportState,
  loadPushPreference,
  type PushPreferenceResponse,
} from "@/lib/push-client";

const PROMPT_DISMISSED_KEY = "me-pague:notifications-prompt-dismissed";

type PermissionState = NotificationPermission | "unsupported";

const emptyPreference: PushPreferenceResponse = {
  dailyRemindersEnabled: false,
  hasSubscription: false,
  reminderDaysBefore: 1,
  timezone: "America/Sao_Paulo",
};

export function usePushNotifications() {
  const { user } = useAuth();
  const [preference, setPreference] = useState<PushPreferenceResponse>(emptyPreference);
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);

  const isDemoUser = user?.id === DEMO_USER_ID;

  const refresh = useCallback(async () => {
    const support = getPushSupportState();
    setSupported(support.supported);
    setPermission(support.permission);
    setPromptDismissed(window.localStorage.getItem(PROMPT_DISMISSED_KEY) === "true");

    if (!user || isDemoUser || !support.supported) {
      setPreference(emptyPreference);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setPreference(await loadPushPreference());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar as notificacoes.");
    } finally {
      setLoading(false);
    }
  }, [isDemoUser, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      const nextPreference = await enablePushNotifications();
      const support = getPushSupportState();
      setPreference(nextPreference);
      setPermission(support.permission);
      window.localStorage.setItem("me-pague:notifications-enabled", "true");
      window.localStorage.removeItem(PROMPT_DISMISSED_KEY);
      setPromptDismissed(false);
      return nextPreference;
    } catch (enableError) {
      const message = enableError instanceof Error ? enableError.message : "Nao foi possivel ativar notificacoes.";
      setError(message);
      throw enableError;
    } finally {
      setSaving(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      const nextPreference = await disablePushNotifications();
      const support = getPushSupportState();
      setPreference(nextPreference);
      setPermission(support.permission);
      window.localStorage.setItem("me-pague:notifications-enabled", "false");
      return nextPreference;
    } catch (disableError) {
      const message = disableError instanceof Error ? disableError.message : "Nao foi possivel desativar notificacoes.";
      setError(message);
      throw disableError;
    } finally {
      setSaving(false);
    }
  }, []);

  const dismissPrompt = useCallback(() => {
    window.localStorage.setItem(PROMPT_DISMISSED_KEY, "true");
    setPromptDismissed(true);
  }, []);

  return useMemo(
    () => ({
      canAsk: Boolean(user && !isDemoUser && supported && permission === "default"),
      dailyRemindersEnabled: preference.dailyRemindersEnabled,
      disable,
      dismissPrompt,
      enable,
      error,
      hasSubscription: preference.hasSubscription,
      isDemoUser,
      loading,
      permission,
      promptDismissed,
      refresh,
      saving,
      supported,
    }),
    [
      disable,
      dismissPrompt,
      enable,
      error,
      isDemoUser,
      loading,
      permission,
      preference.dailyRemindersEnabled,
      preference.hasSubscription,
      promptDismissed,
      refresh,
      saving,
      supported,
      user,
    ],
  );
}
