"use client";

import { supabase } from "@/lib/supabase";

export type PushPreferenceResponse = {
  dailyRemindersEnabled: boolean;
  hasSubscription: boolean;
  reminderDaysBefore: 1;
  timezone: string;
};

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Sessao expirada. Entre novamente para ativar notificacoes.");
  }

  return token;
}

async function fetchWithAuth(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : "Nao foi possivel salvar as notificacoes.");
  }

  return response;
}

export function getPushSupportState() {
  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(vapidPublicKey);

  return {
    permission: supported ? Notification.permission : "unsupported",
    supported,
  } as const;
}

export async function loadPushPreference() {
  const response = await fetchWithAuth("/api/notifications/preferences");
  return (await response.json()) as PushPreferenceResponse;
}

export async function enablePushNotifications() {
  const support = getPushSupportState();

  if (!support.supported) {
    throw new Error("Este navegador ainda nao suporta notificacoes do PWA.");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Permissao de notificacao nao concedida.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  const readyRegistration = await navigator.serviceWorker.ready;
  const activeRegistration = readyRegistration || registration;
  let subscription = await activeRegistration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await activeRegistration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      userVisibleOnly: true,
    });
  }

  const response = await fetchWithAuth("/api/notifications/subscriptions", {
    body: JSON.stringify({
      subscription: subscription.toJSON(),
    }),
    method: "POST",
  });

  return (await response.json()) as PushPreferenceResponse;
}

export async function disablePushNotifications() {
  await fetchWithAuth("/api/notifications/preferences", {
    body: JSON.stringify({
      dailyRemindersEnabled: false,
    }),
    method: "PATCH",
  });

  const support = getPushSupportState();
  let endpoint = "";

  if (support.supported) {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();

    if (subscription) {
      endpoint = subscription.endpoint;
      await subscription.unsubscribe().catch(() => false);
    }
  }

  await fetchWithAuth("/api/notifications/subscriptions", {
    body: JSON.stringify({ endpoint }),
    method: "DELETE",
  }).catch(() => undefined);

  return {
    dailyRemindersEnabled: false,
    hasSubscription: false,
    reminderDaysBefore: 1,
    timezone: "America/Sao_Paulo",
  } satisfies PushPreferenceResponse;
}
