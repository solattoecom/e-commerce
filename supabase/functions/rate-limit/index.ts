import { createClient } from "npm:@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIMITS: Record<string, { max: number; windowSeconds: number }> = {
  login:  { max: 5, windowSeconds: 300 },   // 5 falhas por 5 min
  signup: { max: 3, windowSeconds: 3600 },  // 3 tentativas por hora
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function getIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const { action, op } = await req.json().catch(() => ({}));

  if (!["login", "signup"].includes(action) || !["check", "record"].includes(op)) {
    return json({ error: "Parâmetros inválidos." }, 400);
  }

  const ip = getIp(req);
  const limit = LIMITS[action];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const windowStart = new Date(Date.now() - limit.windowSeconds * 1000).toISOString();

  if (op === "check") {
    const { count } = await supabase
      .from("auth_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("action", action)
      .gte("attempted_at", windowStart);

    if ((count ?? 0) >= limit.max) {
      const { data: oldest } = await supabase
        .from("auth_rate_limits")
        .select("attempted_at")
        .eq("ip", ip)
        .eq("action", action)
        .gte("attempted_at", windowStart)
        .order("attempted_at", { ascending: true })
        .limit(1)
        .single();

      const retryAfterSeconds = oldest
        ? Math.ceil((new Date(oldest.attempted_at).getTime() + limit.windowSeconds * 1000 - Date.now()) / 1000)
        : limit.windowSeconds;

      return json({ blocked: true, retryAfterSeconds }, 429);
    }

    return json({ blocked: false });
  }

  // op === "record"
  await supabase.from("auth_rate_limits").insert({ ip, action });

  // Limpa registros com mais de 24h
  await supabase
    .from("auth_rate_limits")
    .delete()
    .lt("attempted_at", new Date(Date.now() - 86400 * 1000).toISOString());

  return json({ ok: true });
});
