import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { adminErrorResponse, AdminApiError, requireSuperAdmin, writeAdminAuditLog, type AdminContext } from "@/lib/admin-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { AdminUserSummary, RiskLevel, UserRole, UserStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  plan: "free" | "pro";
  role?: UserRole;
  status?: UserStatus | "blocked" | "deleted";
  admin_notes?: string | null;
  status_reason?: string | null;
  status_changed_at?: string | null;
  status_changed_by?: string | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type RecentLogRow = {
  target_user_id?: string | null;
  action: string;
  created_at: string;
};

const roles: UserRole[] = ["user", "support", "operations", "admin", "superadmin"];
const statuses: UserStatus[] = ["pending", "active", "inactive"];
const plans: Array<"free" | "pro"> = ["free", "pro"];
const sensitiveActions = new Set([
  "admin.password_reset",
  "admin.user_deleted",
  "admin.user_status_changed",
  "admin.user_role_changed",
  "admin.batch_status_changed",
  "admin.batch_role_changed",
]);

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.map(asString).filter(Boolean);
}

function asRole(value: unknown): UserRole | null {
  return roles.includes(value as UserRole) ? (value as UserRole) : null;
}

function asStatus(value: unknown): UserStatus | null {
  return statuses.includes(value as UserStatus) ? (value as UserStatus) : null;
}

function asPlan(value: unknown): "free" | "pro" | null {
  return plans.includes(value as "free" | "pro") ? (value as "free" | "pro") : null;
}

function createTemporaryPassword() {
  return `Mp-${randomBytes(5).toString("base64url")}-9`;
}

function daysSince(value?: string | null) {
  if (!value) return null;

  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;

  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function normalizeStatus(status?: ProfileRow["status"]): UserStatus {
  if (status === "blocked" || status === "deleted") return "inactive";

  return status || "active";
}

function requireStrongConfirmation(input: {
  action: string;
  confirmation: string;
  reason: string;
  role?: UserRole | null;
  status?: UserStatus | null;
}) {
  const isCritical =
    input.action === "reset-password" ||
    input.action === "delete" ||
    input.role === "superadmin";

  if (!isCritical) return;

  if (input.confirmation !== "CONFIRMAR") {
    throw new AdminApiError("Digite CONFIRMAR para executar esta acao critica.");
  }

  if (!input.reason) {
    throw new AdminApiError("Informe o motivo da acao critica.");
  }
}

function calculateRisk(input: {
  profile: ProfileRow | undefined;
  authUser: User | undefined;
  recentSensitiveActionAt?: string | null;
}) {
  const tags: string[] = [];
  let score = 0;
  const rawStatus = input.profile?.status;
  const status = normalizeStatus(rawStatus);
  const role = input.profile?.role || "user";
  const daysLastAccess = daysSince(input.authUser?.last_sign_in_at);
  const daysCreated = daysSince(input.profile?.created_at || input.authUser?.created_at);

  if (status === "pending") {
    score += 30;
    tags.push("Aguardando revisao");
  }

  if (status === "inactive") {
    score += rawStatus === "blocked" ? 55 : rawStatus === "deleted" ? 70 : 25;
    tags.push("Conta inativa");
  }

  if (!input.authUser?.email_confirmed_at && !input.authUser?.confirmed_at) {
    score += 20;
    tags.push("Email sem confirmacao");
  }

  if (daysLastAccess === null) {
    score += 18;
    tags.push("Nunca acessou");
  } else if (daysLastAccess >= 45) {
    score += 18;
    tags.push("Sem acesso recente");
  }

  if (daysCreated !== null && daysCreated <= 7) {
    score += 12;
    tags.push("Conta nova");
  }

  if (role === "admin" || role === "support" || role === "operations") {
    score += 12;
    tags.push("Perfil operacional");
  }

  if (role === "superadmin") {
    score += 25;
    tags.push("Acesso maximo");
  }

  if (input.recentSensitiveActionAt) {
    score += 15;
    tags.push("Acao sensivel recente");
  }

  const riskLevel: RiskLevel = score >= 55 ? "high" : score >= 25 ? "medium" : "low";

  return { riskLevel, riskScore: score, riskTags: tags };
}

async function listAuthUsers(admin: SupabaseClient) {
  const users: User[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) throw error;

    users.push(...(data.users || []));

    if ((data.users || []).length < 1000) break;
    page += 1;
  }

  return users;
}

async function loadProfiles(admin: SupabaseClient) {
  const fullSelect =
    "id,name,email,plan,role,status,admin_notes,status_reason,status_changed_at,status_changed_by,deleted_at,created_at,updated_at";
  const basicSelect = "id,name,email,plan,role,status,created_at,updated_at";
  const fullResult = await admin.from("profiles").select(fullSelect);

  if (!fullResult.error) {
    return {
      profiles: (fullResult.data || []) as ProfileRow[],
      schemaReady: true,
    };
  }

  if (fullResult.error.code !== "42703") {
    throw fullResult.error;
  }

  const basicResult = await admin.from("profiles").select(basicSelect);

  if (basicResult.error) throw basicResult.error;

  return {
    profiles: (basicResult.data || []) as ProfileRow[],
    schemaReady: false,
  };
}

async function loadUserSummaries(admin: SupabaseClient): Promise<{ schemaReady: boolean; users: AdminUserSummary[] }> {
  const [authUsers, profilesResult, recentLogsResult] = await Promise.all([
    listAuthUsers(admin),
    loadProfiles(admin),
    admin
      .from("audit_logs")
      .select("target_user_id,action,created_at")
      .in("action", Array.from(sensitiveActions))
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  if (recentLogsResult.error) throw recentLogsResult.error;

  const profiles = profilesResult.profiles.reduce(
    (acc, profile) => acc.set(profile.id, profile),
    new Map<string, ProfileRow>(),
  );
  const authById = authUsers.reduce((acc, authUser) => acc.set(authUser.id, authUser), new Map<string, User>());
  const recentSensitiveActions = ((recentLogsResult.data || []) as RecentLogRow[]).reduce(
    (acc, row) => {
      if (row.target_user_id && !acc.has(row.target_user_id)) {
        acc.set(row.target_user_id, row.created_at);
      }
      return acc;
    },
    new Map<string, string>(),
  );
  const ids = new Set([...Array.from(profiles.keys()), ...authUsers.map((authUser) => authUser.id)]);

  const users = Array.from(ids).map((id) => {
    const authUser = authById.get(id);
    const profile = profiles.get(id);
    const recentSensitiveActionAt = recentSensitiveActions.get(id) || null;
    const risk = calculateRisk({ authUser, profile, recentSensitiveActionAt });

    return {
      id,
      name: profile?.name || authUser?.user_metadata?.name || authUser?.email?.split("@")[0] || "Usuario",
      email: profile?.email || authUser?.email || "",
      plan: profile?.plan || "free",
      role: profile?.role || "user",
      status: normalizeStatus(profile?.status),
      authCreatedAt: authUser?.created_at,
      createdAt: profile?.created_at,
      updatedAt: profile?.updated_at,
      lastSignInAt: authUser?.last_sign_in_at,
      emailConfirmedAt: authUser?.email_confirmed_at || authUser?.confirmed_at,
      adminNotes: profile?.admin_notes || "",
      statusReason: profile?.status_reason || "",
      statusChangedAt: profile?.status_changed_at,
      statusChangedBy: profile?.status_changed_by,
      deletedAt: profile?.deleted_at,
      daysSinceCreated: daysSince(profile?.created_at || authUser?.created_at),
      daysSinceLastSignIn: daysSince(authUser?.last_sign_in_at),
      recentSensitiveActionAt,
      riskLevel: risk.riskLevel,
      riskScore: risk.riskScore,
      riskTags: risk.riskTags,
    };
  });

  return { schemaReady: profilesResult.schemaReady, users };
}

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 30 requisições por minuto por IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`admin-users-get:${ip}`, 30, 60_000);

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Muitas requisicoes. Tente novamente em breve." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } },
      );
    }

    const context = await requireSuperAdmin(request);
    const result = await loadUserSummaries(context.admin);
    const statusWeight: Record<UserStatus, number> = {
      pending: 0,
      active: 1,
      inactive: 2,
    };

    return NextResponse.json({
      schemaReady: result.schemaReady,
      users: result.users.sort((a, b) => {
        const byRisk = b.riskScore - a.riskScore;
        if (byRisk !== 0) return byRisk;

        const byStatus = statusWeight[a.status] - statusWeight[b.status];
        if (byStatus !== 0) return byStatus;

        return (b.createdAt || b.authCreatedAt || "").localeCompare(a.createdAt || a.authCreatedAt || "");
      }),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 criações por minuto por IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`admin-users-post:${ip}`, 10, 60_000);

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Muitas requisicoes. Tente novamente em breve." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } },
      );
    }

    const context = await requireSuperAdmin(request);
    const body = await request.json();
    const email = asString(body.email).toLowerCase();
    const name = asString(body.name) || email.split("@")[0] || "Usuario";
    const password = asString(body.password) || createTemporaryPassword();
    const plan = asPlan(body.plan) || "free";
    const role = asRole(body.role) || "user";
    const status = asStatus(body.status) || "active";
    const reason = asString(body.reason) || "Criacao administrativa";

    requireStrongConfirmation({
      action: "create",
      confirmation: asString(body.confirmation),
      reason,
      role,
      status,
    });

    if (!email || !email.includes("@")) {
      throw new AdminApiError("Informe um email valido.");
    }

    if (password.length < 6) {
      throw new AdminApiError("A senha precisa ter pelo menos 6 caracteres.");
    }

    const { data: created, error: createError } = await context.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError) throw createError;
    if (!created.user) throw new AdminApiError("Nao foi possivel criar o usuario.");

    const now = new Date().toISOString();
    const { error: profileError } = await context.admin.from("profiles").upsert(
      {
        id: created.user.id,
        name,
        email,
        pix_key: "",
        plan,
        role,
        status,
        status_reason: reason,
        status_changed_at: now,
        status_changed_by: context.actor.id,
        deleted_at: null,
        updated_at: now,
      },
      { onConflict: "id" },
    );

    if (profileError) throw profileError;

    await writeAdminAuditLog(context, {
      action: "admin.user_created",
      targetUserId: created.user.id,
      metadata: { email, plan, reason, role, status },
    });

    return NextResponse.json({
      userId: created.user.id,
      temporaryPassword: password,
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

async function deleteUsersPermanently(context: AdminContext, userIds: string[], reason: string) {
  const [authUsers, profilesResult] = await Promise.all([
    listAuthUsers(context.admin),
    context.admin
      .from("profiles")
      .select("id,name,email,plan,role,status,admin_notes,status_reason,status_changed_at,status_changed_by,deleted_at,created_at,updated_at")
      .in("id", userIds),
  ]);

  if (profilesResult.error) throw profilesResult.error;

  const authById = authUsers.reduce((acc, authUser) => acc.set(authUser.id, authUser), new Map<string, User>());
  const profileById = ((profilesResult.data || []) as ProfileRow[]).reduce(
    (acc, profile) => acc.set(profile.id, profile),
    new Map<string, ProfileRow>(),
  );

  const targets = userIds.map((id) => {
    const authUser = authById.get(id);
    const profile = profileById.get(id);

    if (!authUser && !profile) {
      throw new AdminApiError("Usuario nao encontrado.");
    }

    return {
      email: profile?.email || authUser?.email || "",
      id,
      name: profile?.name || authUser?.user_metadata?.name || authUser?.email?.split("@")[0] || "Usuario",
    };
  });

  const userScopedTables = [
    "notification_deliveries",
    "push_subscriptions",
    "notification_preferences",
    "charge_logs",
    "payments",
    "debts",
    "customers",
  ];

  for (const table of userScopedTables) {
    const { error } = await context.admin.from(table).delete().in("user_id", userIds);

    if (error) throw error;
  }

  const { error: profilesDeleteError } = await context.admin.from("profiles").delete().in("id", userIds);

  if (profilesDeleteError) throw profilesDeleteError;

  await Promise.all(
    targets.map(async (target) => {
      if (authById.has(target.id)) {
        const { error } = await context.admin.auth.admin.deleteUser(target.id, false);

        if (error) throw error;
      }
    }),
  );

  await Promise.all(
    targets.map((target) =>
      writeAdminAuditLog(context, {
        action: "admin.user_deleted",
        targetUserId: null,
        metadata: {
          deletedUserEmail: target.email,
          deletedUserId: target.id,
          deletedUserName: target.name,
          deletion: "hard",
          reason,
        },
      }),
    ),
  );

  return targets.length;
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requireSuperAdmin(request);
    const body = await request.json();
    const userIds = Array.from(new Set([asString(body.userId), ...asStringArray(body.userIds)].filter(Boolean)));
    const action = asString(body.action) || "update";
    const reason = asString(body.reason);
    const confirmation = asString(body.confirmation);
    const role = asRole(body.role);
    const status = asStatus(body.status);
    const plan = asPlan(body.plan);
    const name = asString(body.name);
    const adminNotes = typeof body.adminNotes === "string" ? body.adminNotes.trim() : null;

    if (userIds.length === 0) {
      throw new AdminApiError("Usuario nao informado.");
    }

    requireStrongConfirmation({ action, confirmation, reason, role, status });

    // Proteção de auto-modificação: superadmin não pode remover seu próprio acesso
    const isSelf = userIds.includes(context.actor.id);

    if (isSelf) {
      if (action === "delete") {
        throw new AdminApiError("Voce nao pode excluir sua propria conta.");
      }

      if (role && role !== "superadmin") {
        throw new AdminApiError("Voce nao pode remover seu proprio papel de superadmin.");
      }

      if (status && status !== "active") {
        throw new AdminApiError("Voce nao pode desativar sua propria conta.");
      }
    }

    if (action === "delete") {
      const deleted = await deleteUsersPermanently(context, userIds, reason || "Exclusao administrativa definitiva");

      return NextResponse.json({ deleted, ok: true });
    }

    if (action === "reset-password") {
      if (userIds.length > 1) {
        throw new AdminApiError("Reset de senha em lote nao e permitido.");
      }

      const password = asString(body.password) || createTemporaryPassword();

      if (password.length < 6) {
        throw new AdminApiError("A senha precisa ter pelo menos 6 caracteres.");
      }

      const { error } = await context.admin.auth.admin.updateUserById(userIds[0], { password });

      if (error) throw error;

      await writeAdminAuditLog(context, {
        action: "admin.password_reset",
        targetUserId: userIds[0],
        metadata: { reason },
      });

      return NextResponse.json({ temporaryPassword: password });
    }

    const now = new Date().toISOString();
    const updates: Record<string, string | null> = {
      updated_at: now,
    };

    if (role) updates.role = role;
    if (status) {
      updates.status = status;
      updates.status_reason = reason || "Alteracao administrativa";
      updates.status_changed_at = now;
      updates.status_changed_by = context.actor.id;
      updates.deleted_at = null;
    }
    if (plan) updates.plan = plan;
    if (name && userIds.length === 1) updates.name = name;
    if (adminNotes !== null) updates.admin_notes = adminNotes;

    if (Object.keys(updates).length === 1) {
      throw new AdminApiError("Nenhuma alteracao informada.");
    }

    const { error } = await context.admin.from("profiles").update(updates).in("id", userIds);

    if (error) throw error;

    const auditAction = status
      ? userIds.length > 1
        ? "admin.batch_status_changed"
        : "admin.user_status_changed"
      : role
        ? userIds.length > 1
          ? "admin.batch_role_changed"
          : "admin.user_role_changed"
        : plan
          ? "admin.user_plan_changed"
          : adminNotes !== null
            ? "admin.user_notes_updated"
            : "admin.user_updated";

    await Promise.all(
      userIds.map((targetUserId) =>
        writeAdminAuditLog(context, {
          action: auditAction,
          targetUserId,
          metadata: { reason, updates },
        }),
      ),
    );

    return NextResponse.json({ ok: true, updated: userIds.length });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
