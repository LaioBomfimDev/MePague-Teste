import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireAuthenticatedUser, userApiErrorResponse } from "@/lib/api-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { UserProfile, UserRole, UserStatus } from "@/lib/types";

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  pix_key: string;
  plan: "free" | "pro";
  role?: UserRole;
  status?: UserStatus;
  admin_notes?: string;
  status_reason?: string;
  status_changed_at?: string | null;
  status_changed_by?: string | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

const profileSelect =
  "id,name,email,pix_key,plan,role,status,admin_notes,status_reason,status_changed_at,status_changed_by,deleted_at,created_at,updated_at";

function getUserDisplayName(user: User) {
  const metadataName = user.user_metadata?.name || user.user_metadata?.full_name;

  return typeof metadataName === "string" && metadataName.trim()
    ? metadataName.trim()
    : user.email?.split("@")[0] || "Meu Perfil";
}

function mapProfile(row: ProfileRow): UserProfile {
  const role = row.role || "user";
  const status = row.status === "pending" && role === "user" ? "active" : row.status || "active";

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    pixKey: row.pix_key,
    plan: row.plan,
    role,
    status,
    adminNotes: row.admin_notes || "",
    statusReason: row.status_reason || "",
    statusChangedAt: row.status_changed_at || undefined,
    statusChangedBy: row.status_changed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getAccessResponse(profile: ProfileRow) {
  if (profile.status === "blocked") {
    return {
      allowed: false,
      message: "Sua conta esta bloqueada. Fale com o suporte.",
      profile: mapProfile(profile),
    };
  }

  if (profile.status === "inactive") {
    return {
      allowed: false,
      message: "Sua conta esta inativa. Fale com o suporte.",
      profile: mapProfile(profile),
    };
  }

  if (profile.status === "deleted" || profile.deleted_at) {
    return {
      allowed: false,
      message: "Esta conta foi excluida do acesso ao app.",
      profile: mapProfile(profile),
    };
  }

  if (profile.status === "pending" && (profile.role || "user") !== "user") {
    return {
      allowed: false,
      message: "Conta administrativa pendente. Fale com o suporte.",
      profile: mapProfile(profile),
    };
  }

  return { allowed: true, profile: mapProfile(profile) };
}

async function fetchProfile(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.from("profiles").select(profileSelect).eq("id", userId).maybeSingle();

  if (error) throw error;

  return data as ProfileRow | null;
}

async function createActiveProfile(admin: SupabaseClient, user: User) {
  const { data, error } = await admin
    .from("profiles")
    .insert({
      id: user.id,
      name: getUserDisplayName(user),
      email: user.email || "",
      pix_key: "",
      plan: "free",
      role: "user",
      status: "active",
      status_reason: "",
      status_changed_at: null,
      status_changed_by: null,
      deleted_at: null,
    })
    .select(profileSelect)
    .single();

  if (error) throw error;

  return data as ProfileRow;
}

async function activatePendingSelfServiceProfile(admin: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("profiles")
    .update({
      status: "active",
      status_reason: "Ativacao automatica no login",
      status_changed_at: now,
      status_changed_by: null,
      updated_at: now,
    })
    .eq("id", userId)
    .eq("role", "user")
    .eq("status", "pending")
    .is("deleted_at", null)
    .select(profileSelect)
    .maybeSingle();

  if (error) throw error;

  return data as ProfileRow | null;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 20 requisições por minuto por IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`auth-profile:${ip}`, 20, 60_000);

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Muitas requisicoes. Tente novamente em breve." },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) },
        },
      );
    }

    const { admin, user } = await requireAuthenticatedUser(request);
    let profile = await fetchProfile(admin, user.id);

    if (!profile) {
      profile = await createActiveProfile(admin, user);
    } else if (profile.status === "pending" && (profile.role || "user") === "user" && !profile.deleted_at) {
      profile = (await activatePendingSelfServiceProfile(admin, user.id)) || (await fetchProfile(admin, user.id));
    }

    if (!profile) {
      profile = await createActiveProfile(admin, user);
    }

    return NextResponse.json(getAccessResponse(profile));
  } catch (error) {
    return userApiErrorResponse(error);
  }
}
