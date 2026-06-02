import { type NextRequest, NextResponse } from "next/server";

/**
 * Rotas que exigem autenticação.
 * O middleware redireciona para /login se não houver sessão ativa.
 */
const PROTECTED_PREFIXES = [
  "/",
  "/debtors",
  "/new-debt",
  "/reports",
  "/profile",
  "/admin",
];

/**
 * Rotas que nunca exigem autenticação.
 * Têm prioridade sobre PROTECTED_PREFIXES.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/",
  "/_next/",
  "/favicon",
  "/logo",
  "/icons/",
  "/manifest.json",
  "/sw.js",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || (prefix !== "/" && pathname.startsWith(prefix + "/")),
  );
}

/**
 * Extrai o token de sessão Supabase dos cookies.
 * O Supabase armazena a sessão em cookies com o prefixo sb- ou na chave configurada.
 */
function extractSessionToken(request: NextRequest): string | null {
  // Chave customizada usada no supabase.ts
  const storageKey = "me-pague:supabase-auth-v2";

  // Tenta cookie direto pelo storage key
  const directCookie = request.cookies.get(storageKey)?.value;
  if (directCookie) return directCookie;

  // Tenta cookies padrão do Supabase (sb-<project>-auth-token)
  const cookieMatch = Array.from(request.cookies.getAll()).find(
    (cookie) => cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token"),
  );

  return cookieMatch?.value ?? null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas públicas: passa sempre
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Rotas protegidas: verifica sessão
  if (isProtected(pathname)) {
    const token = extractSessionToken(request);

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      // Preserva a rota original para redirecionar depois do login
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Executa o middleware em todas as rotas exceto arquivos estáticos do Next
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
