import { NextResponse, type NextRequest } from "next/server";
import { requireAuthenticatedUser, userApiErrorResponse, UserApiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PreferenceRow = {
  daily_reminders_enabled: boolean;
  reminder_days_before: 1;
  timezone: string;
};

function asEnabled(value: unknown) {
  if (typeof value !== "boolean") {
    throw new UserApiError("Informe se as notificacoes devem ficar ativas.");
  }

  return value;
}

export async function GET(request: NextRequest) {
  try {
    const { admin, user } = await requireAuthenticatedUser(request);

    const [preferenceResult, subscriptionResult] = await Promise.all([
      admin
        .from("notification_preferences")
        .select("daily_reminders_enabled,reminder_days_before,timezone")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true),
    ]);

    if (preferenceResult.error) throw preferenceResult.error;
    if (subscriptionResult.error) throw subscriptionResult.error;

    const preference = preferenceResult.data as PreferenceRow | null;

    return NextResponse.json({
      dailyRemindersEnabled: preference?.daily_reminders_enabled ?? false,
      hasSubscription: (subscriptionResult.count || 0) > 0,
      reminderDaysBefore: preference?.reminder_days_before ?? 1,
      timezone: preference?.timezone || "America/Sao_Paulo",
    });
  } catch (error) {
    return userApiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin, user } = await requireAuthenticatedUser(request);
    const body = await request.json();
    const enabled = asEnabled(body.dailyRemindersEnabled ?? body.enabled);
    const now = new Date().toISOString();

    const { error } = await admin.from("notification_preferences").upsert(
      {
        user_id: user.id,
        daily_reminders_enabled: enabled,
        reminder_days_before: 1,
        timezone: "America/Sao_Paulo",
        updated_at: now,
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;

    return NextResponse.json({
      dailyRemindersEnabled: enabled,
      reminderDaysBefore: 1,
      timezone: "America/Sao_Paulo",
    });
  } catch (error) {
    return userApiErrorResponse(error);
  }
}
