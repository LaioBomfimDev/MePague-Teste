import { NextResponse, type NextRequest } from "next/server";
import { requireAuthenticatedUser, userApiErrorResponse, UserApiError } from "@/lib/api-auth";
import type { StoredPushSubscription } from "@/lib/web-push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseSubscription(value: unknown): StoredPushSubscription {
  const subscription = value as Partial<StoredPushSubscription> | null;

  if (
    !subscription ||
    typeof subscription.endpoint !== "string" ||
    !subscription.endpoint ||
    !subscription.keys ||
    typeof subscription.keys.auth !== "string" ||
    typeof subscription.keys.p256dh !== "string"
  ) {
    throw new UserApiError("Assinatura de notificacao invalida.");
  }

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      auth: subscription.keys.auth,
      p256dh: subscription.keys.p256dh,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const { admin, user } = await requireAuthenticatedUser(request);
    const body = await request.json();
    const subscription = parseSubscription(body.subscription);
    const userAgent = request.headers.get("user-agent") || "";
    const now = new Date().toISOString();

    const { error: subscriptionError } = await admin.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        subscription,
        user_agent: userAgent.slice(0, 500),
        is_active: true,
        last_seen_at: now,
        failed_at: null,
        failure_reason: "",
        updated_at: now,
      },
      { onConflict: "endpoint" },
    );

    if (subscriptionError) throw subscriptionError;

    const { error: preferenceError } = await admin.from("notification_preferences").upsert(
      {
        user_id: user.id,
        daily_reminders_enabled: true,
        reminder_days_before: 1,
        timezone: "America/Sao_Paulo",
        updated_at: now,
      },
      { onConflict: "user_id" },
    );

    if (preferenceError) throw preferenceError;

    return NextResponse.json({
      dailyRemindersEnabled: true,
      hasSubscription: true,
      reminderDaysBefore: 1,
    });
  } catch (error) {
    return userApiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { admin, user } = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    const now = new Date().toISOString();

    let query = admin
      .from("push_subscriptions")
      .update({
        is_active: false,
        updated_at: now,
      })
      .eq("user_id", user.id);

    if (endpoint) {
      query = query.eq("endpoint", endpoint);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return userApiErrorResponse(error);
  }
}
