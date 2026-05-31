import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { formatCurrency } from "@/lib/format";
import { isWebPushConfigured, sendWebPush, type StoredPushSubscription } from "@/lib/web-push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REMINDER_RULE = "due_tomorrow";
const TIMEZONE = "America/Sao_Paulo";

type CronError = Error & { status?: number };

type PreferenceRow = {
  user_id: string;
};

type DebtReminderRow = {
  id: string;
  user_id: string;
  customer_name: string;
  amount: number | string;
  due_date: string;
};

type PaymentRow = {
  debt_id: string;
  amount: number | string;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  subscription: StoredPushSubscription;
};

type ReminderItem = {
  customerName: string;
  debtId: string;
  outstandingAmount: number;
};

function createCronError(message: string, status = 500): CronError {
  const error = new Error(message) as CronError;
  error.status = status;
  return error;
}

function requireCronAccess(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;

  if (!secret) {
    throw createCronError("CRON_SECRET nao configurado.");
  }

  const authorization = request.headers.get("authorization") || "";
  const querySecret = request.nextUrl.searchParams.get("secret") || "";

  if (authorization === `Bearer ${secret}` || querySecret === secret) {
    return;
  }

  throw createCronError("Acesso nao autorizado.", 401);
}

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);

  return {
    day: parts.find((part) => part.type === "day")?.value || "01",
    month: parts.find((part) => part.type === "month")?.value || "01",
    year: parts.find((part) => part.type === "year")?.value || "1970",
  };
}

function addDaysToDateString(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function getTomorrowDateInTimeZone(timeZone: string) {
  const today = getDatePartsInTimeZone(new Date(), timeZone);
  return addDaysToDateString(`${today.year}-${today.month}-${today.day}`, 1);
}

function getTargetDate(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("targetDate") || "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
    return requested;
  }

  return getTomorrowDateInTimeZone(TIMEZONE);
}

function groupPaymentsByDebt(payments: PaymentRow[]) {
  return payments.reduce((acc, payment) => {
    acc.set(payment.debt_id, (acc.get(payment.debt_id) || 0) + Number(payment.amount));
    return acc;
  }, new Map<string, number>());
}

function buildReminderPayload(items: ReminderItem[], targetDate: string) {
  const totalAmount = items.reduce((sum, item) => sum + item.outstandingAmount, 0);
  const title = items.length === 1 ? "Recebimento amanha" : "Recebimentos amanha";
  const body =
    items.length === 1
      ? `Amanha voce tem ${formatCurrency(totalAmount)} para receber de ${items[0].customerName}.`
      : `Amanha voce tem ${items.length} recebimentos previstos, totalizando ${formatCurrency(totalAmount)}.`;

  return {
    badge: "/logo.jpeg",
    body,
    icon: "/logo.jpeg",
    tag: `me-pague-${REMINDER_RULE}-${targetDate}`,
    targetDate,
    title,
    totalAmount,
    type: REMINDER_RULE,
    url: "/debtors?filter=open",
  };
}

async function deactivateFailedSubscription(input: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  endpoint: string;
  reason: string;
}) {
  await input.admin
    .from("push_subscriptions")
    .update({
      failed_at: new Date().toISOString(),
      failure_reason: input.reason.slice(0, 500),
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("endpoint", input.endpoint);
}

async function runDailyReminders(request: NextRequest) {
  try {
    requireCronAccess(request);

    if (!isWebPushConfigured()) {
      throw createCronError("Web Push nao configurado.");
    }

    const admin = getSupabaseAdmin();
    const targetDate = getTargetDate(request);
    const { data: preferences, error: preferenceError } = await admin
      .from("notification_preferences")
      .select("user_id")
      .eq("daily_reminders_enabled", true)
      .eq("reminder_days_before", 1);

    if (preferenceError) throw preferenceError;

    const userIds = ((preferences || []) as PreferenceRow[]).map((preference) => preference.user_id);

    if (userIds.length === 0) {
      return NextResponse.json({ delivered: 0, skipped: 0, targetDate });
    }

    const { data: debts, error: debtError } = await admin
      .from("debts")
      .select("id,user_id,customer_name,amount,due_date")
      .eq("status", "open")
      .eq("due_date", targetDate)
      .in("user_id", userIds);

    if (debtError) throw debtError;

    const debtRows = (debts || []) as DebtReminderRow[];

    if (debtRows.length === 0) {
      return NextResponse.json({ delivered: 0, skipped: userIds.length, targetDate });
    }

    const { data: payments, error: paymentError } = await admin
      .from("payments")
      .select("debt_id,amount")
      .in(
        "debt_id",
        debtRows.map((debt) => debt.id),
      );

    if (paymentError) throw paymentError;

    const paymentsByDebt = groupPaymentsByDebt((payments || []) as PaymentRow[]);
    const remindersByUser = debtRows.reduce((acc, debt) => {
      const outstandingAmount = Math.max(0, Number(debt.amount) - (paymentsByDebt.get(debt.id) || 0));

      if (outstandingAmount <= 0) {
        return acc;
      }

      const items = acc.get(debt.user_id) || [];
      items.push({
        customerName: debt.customer_name,
        debtId: debt.id,
        outstandingAmount,
      });
      acc.set(debt.user_id, items);
      return acc;
    }, new Map<string, ReminderItem[]>());

    const reminderUserIds = Array.from(remindersByUser.keys());

    if (reminderUserIds.length === 0) {
      return NextResponse.json({ delivered: 0, skipped: userIds.length, targetDate });
    }

    const { data: subscriptions, error: subscriptionError } = await admin
      .from("push_subscriptions")
      .select("id,user_id,endpoint,subscription")
      .eq("is_active", true)
      .in("user_id", reminderUserIds);

    if (subscriptionError) throw subscriptionError;

    const subscriptionsByUser = ((subscriptions || []) as PushSubscriptionRow[]).reduce((acc, subscription) => {
      const items = acc.get(subscription.user_id) || [];
      items.push(subscription);
      acc.set(subscription.user_id, items);
      return acc;
    }, new Map<string, PushSubscriptionRow[]>());

    let delivered = 0;
    let failed = 0;
    let skipped = 0;

    for (const [userId, items] of Array.from(remindersByUser.entries())) {
      const userSubscriptions = subscriptionsByUser.get(userId) || [];

      if (userSubscriptions.length === 0) {
        skipped += 1;
        continue;
      }

      const payload = buildReminderPayload(items, targetDate);
      const { error: deliveryError } = await admin.from("notification_deliveries").insert({
        payload,
        rule: REMINDER_RULE,
        target_date: targetDate,
        user_id: userId,
      });

      if (deliveryError) {
        if ((deliveryError as { code?: string }).code === "23505") {
          skipped += 1;
          continue;
        }

        throw deliveryError;
      }

      const results = await Promise.allSettled(
        userSubscriptions.map((subscription) => sendWebPush(subscription.subscription, payload)),
      );

      const successful = results.filter((result) => result.status === "fulfilled").length;
      delivered += successful > 0 ? 1 : 0;
      failed += successful > 0 ? 0 : 1;

      await Promise.all(
        results.map(async (result, index) => {
          if (result.status === "fulfilled") return;

          const pushError = result.reason as { body?: string; message?: string; statusCode?: number };
          const statusCode = pushError.statusCode || 0;

          if (statusCode === 404 || statusCode === 410) {
            await deactivateFailedSubscription({
              admin,
              endpoint: userSubscriptions[index].endpoint,
              reason: pushError.body || pushError.message || `Push falhou com status ${statusCode}`,
            });
          }
        }),
      );
    }

    return NextResponse.json({
      delivered,
      failed,
      skipped,
      targetDate,
    });
  } catch (error) {
    const cronError = error as CronError;
    const message = cronError.message || "Erro interno.";
    return NextResponse.json({ error: message }, { status: cronError.status || 500 });
  }
}

export function GET(request: NextRequest) {
  return runDailyReminders(request);
}

export function POST(request: NextRequest) {
  return runDailyReminders(request);
}
