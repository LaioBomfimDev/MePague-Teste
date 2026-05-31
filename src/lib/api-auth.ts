import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type UserApiContext = {
  admin: SupabaseClient;
  user: User;
};

export class UserApiError extends Error {
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

export async function requireAuthenticatedUser(request: NextRequest): Promise<UserApiContext> {
  const admin = getSupabaseAdmin();
  const token = getBearerToken(request);

  if (!token) {
    throw new UserApiError("Sessao ausente.", 401);
  }

  const { data, error } = await admin.auth.getUser(token);

  if (error || !data.user) {
    throw new UserApiError("Sessao invalida.", 401);
  }

  return {
    admin,
    user: data.user,
  };
}

export function userApiErrorResponse(error: unknown) {
  if (error instanceof UserApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Erro interno.";
  return NextResponse.json({ error: message }, { status: 500 });
}
