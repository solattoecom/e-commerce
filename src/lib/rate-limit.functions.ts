const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rate-limit`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const HEADERS = {
  "Content-Type": "application/json",
  "apikey": ANON_KEY,
  "Authorization": `Bearer ${ANON_KEY}`,
};

export type RateLimitAction = "login" | "signup";

export async function checkRateLimit(action: RateLimitAction): Promise<{ blocked: boolean; retryAfterSeconds?: number }> {
  try {
    const res = await fetch(FUNCTION_URL, { method: "POST", headers: HEADERS, body: JSON.stringify({ action, op: "check" }) });
    const data = await res.json();
    return { blocked: data.blocked ?? false, retryAfterSeconds: data.retryAfterSeconds };
  } catch {
    return { blocked: false };
  }
}

export async function recordRateLimitAttempt(action: RateLimitAction): Promise<void> {
  try {
    await fetch(FUNCTION_URL, { method: "POST", headers: HEADERS, body: JSON.stringify({ action, op: "record" }) });
  } catch {
    // silently fail — não bloqueia o fluxo principal
  }
}
