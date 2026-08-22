import { env } from "cloudflare:workers";

export type PublicFormName = "guestbook" | "player-submissions" | "submissions";

const dailyLimits: Record<PublicFormName, number> = {
  guestbook: 40,
  "player-submissions": 20,
  submissions: 20,
};

const jsonHeaders = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export function rejectOversizedContentLength(
  request: Request,
  maxBytes: number,
  message: string,
) {
  const value = request.headers.get("content-length");
  if (value === null) return null;
  if (!/^\d+$/.test(value.trim())) {
    return Response.json(
      { error: "请求大小信息无效，请刷新后重试。" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const contentLength = Number(value);
  if (!Number.isSafeInteger(contentLength) || contentLength > maxBytes) {
    return Response.json({ error: message }, { status: 413, headers: jsonHeaders });
  }
  return null;
}

export function getUtcDayWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    key: start.toISOString().slice(0, 10),
    retryAfterSeconds: Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 1000)),
  };
}

function getClientAddress(request: Request) {
  const cloudflareAddress = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareAddress) return cloudflareAddress.slice(0, 128);

  const forwardedAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwardedAddress || "unknown-client").slice(0, 128);
}

function getClientIdentity(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  return userId ? `user:${userId.slice(0, 180)}` : `ip:${getClientAddress(request)}`;
}

export async function hashClientAddress(address: string, windowKey = getUtcDayWindow().key) {
  // Rotate the stored digest daily so rate-limit rows cannot be linked across
  // dates. Signed-in visitors are keyed by Site user ID; anonymous visitors
  // fall back to their network address.
  const input = new TextEncoder().encode(`jdfc-public-form-v2:${windowKey}:${address}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforcePublicFormRateLimit(request: Request, form: PublicFormName) {
  const { key, retryAfterSeconds } = getUtcDayWindow();

  try {
    if (!env.DB) throw new Error("D1 unavailable");
    const fingerprint = await hashClientAddress(getClientIdentity(request), key);
    const row = await env.DB.prepare(`
      INSERT INTO public_form_rate_limits (
        form, fingerprint, window_start, count, updated_at
      ) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(form, fingerprint, window_start)
      DO UPDATE SET
        count = public_form_rate_limits.count + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING count
    `).bind(form, fingerprint, key).first<{ count: number }>();

    if (!row || !Number.isFinite(Number(row.count))) throw new Error("Rate limit write failed");
    const cleanupSample = crypto.getRandomValues(new Uint8Array(1))[0];
    if (cleanupSample === 0) {
      await env.DB.prepare("DELETE FROM public_form_rate_limits WHERE updated_at < datetime('now', '-14 days')").run();
    }
    if (Number(row.count) > dailyLimits[form]) {
      return Response.json(
        { error: "今天的提交次数已达上限，请稍后再试。" },
        {
          status: 429,
          headers: { ...jsonHeaders, "retry-after": String(retryAfterSeconds) },
        },
      );
    }
    return null;
  } catch {
    return Response.json(
      { error: "提交保护服务暂不可用，请稍后重试。" },
      { status: 503, headers: { ...jsonHeaders, "retry-after": "60" } },
    );
  }
}
