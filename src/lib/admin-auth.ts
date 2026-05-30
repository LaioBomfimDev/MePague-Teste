import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { UserRole, UserStatus } from "@/lib/types";

type AdminProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
};

export type AdminContext = {
  actor: User;
  actorProfile: AdminProfile;
  admin: SupabaseClient;
};

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function requireSuperAdmin(request: NextRequest): Promise<AdminContext> {
  const admin = getSupabaseAdmin();
  const token = getBearerToken(request);

  if (!token) {
    throw new AdminApiError("Sessao administrativa ausente.", 401);
  }

  const { data: authData, error: authError } = await admin.auth.getUser(token);

  if (authError || !authData.user) {
    throw new AdminApiError("Sessao administrativa invalida.", 401);
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,email,name,role,status")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile || profile.role !== "superadmin" || profile.status !== "active") {
    throw new AdminApiError("Acesso restrito ao superadm.", 403);
  }

  return {
    actor: authData.user,
    actorProfile: profile as AdminProfile,
    admin,
  };
}

export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Erro interno.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function writeAdminAuditLog(
  context: AdminContext,
  input: {
    action: string;
    targetUserId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await context.admin.from("audit_logs").insert({
    actor_id: context.actor.id,
    actor_email: context.actor.email || context.actorProfile.email || "",
    target_user_id: input.targetUserId || null,
    action: input.action,
    table_name: "admin",
    metadata: input.metadata || {},
  });

  if (error) throw error;
}
