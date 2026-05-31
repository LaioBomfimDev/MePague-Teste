import webpush, { type PushSubscription } from "web-push";

let configured = false;

export type StoredPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
};

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
}

export function isWebPushConfigured() {
  return Boolean(getVapidPublicKey() && process.env.VAPID_PRIVATE_KEY);
}

export function configureWebPush() {
  if (configured) return;

  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error("Web Push nao configurado. Defina NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.");
  }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:suporte@mepague.app", publicKey, privateKey);
  configured = true;
}

export function sendWebPush(subscription: StoredPushSubscription, payload: Record<string, unknown>) {
  configureWebPush();
  return webpush.sendNotification(subscription as PushSubscription, JSON.stringify(payload));
}
