/**
 * Rate limiter em memória simples para APIs do Next.js.
 * Adequado para deploy em Vercel (sem estado persistente entre instâncias).
 * Para escala maior, substituir por Redis/KV.
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

// Limpeza periódica de entradas expiradas a cada 5 minutos
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  Array.from(store.entries()).forEach(([key, entry]) => {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  });
}

if (typeof setInterval !== "undefined") {
  setInterval(cleanup, CLEANUP_INTERVAL_MS);
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
};

/**
 * Verifica se uma chave excedeu o limite de requisições.
 *
 * @param key - Identificador único (ex: IP do cliente, user ID)
 * @param limit - Número máximo de requisições permitidas na janela
 * @param windowMs - Duração da janela em milissegundos
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // Janela nova ou expirada
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count };
}

/**
 * Extrai o IP real do cliente a partir dos headers do Next.js.
 * Suporta Vercel, Cloudflare e proxies padrão.
 */
export function getClientIp(request: Request): string {
  const headers = request instanceof Request ? request.headers : (request as { headers: Headers }).headers;

  return (
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
