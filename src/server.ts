import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleAbacatePayWebhook } from "./lib/webhook-abacatepay";
import { handleAsaasWebhook } from "./lib/webhook-asaas";
import { handleMelhorEnvioWebhook } from "./lib/webhook-melhorenvio";
import { runTrackingCron } from "./lib/tracking-cron";
import { runLowStockCron } from "./lib/low-stock-cron";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

async function generateSitemap(): Promise<Response> {
  try {
    const { supabaseAdmin } = await import("./integrations/supabase/external.server");
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("slug, criado_em")
      .eq("ativo", true)
      .order("criado_em", { ascending: false });

    const base = "https://www.solatto.com.br";
    const staticPages = [
      { url: base, priority: "1.0", changefreq: "daily" },
      { url: `${base}/entrar`, priority: "0.3", changefreq: "yearly" },
    ];

    const productUrls = (products ?? []).map((p: { slug: string; criado_em: string }) => ({
      url: `${base}/produto/${p.slug}`,
      priority: "0.8",
      changefreq: "weekly",
      lastmod: p.criado_em.slice(0, 10),
    }));

    const allUrls = [...staticPages, ...productUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${u.url}</loc>
    ${"lastmod" in u ? `<lastmod>${u.lastmod}</lastmod>\n    ` : ""}<changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("sitemap error:", err);
    return new Response("error generating sitemap", { status: 500 });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/webhook/abacatepay" && request.method === "POST") {
        return await handleAbacatePayWebhook(request);
      }

      if (url.pathname === "/api/webhook/melhorenvio" && request.method === "POST") {
        return await handleMelhorEnvioWebhook(request);
      }

      if (url.pathname === "/api/webhook/asaas" && request.method === "POST") {
        return await handleAsaasWebhook(request);
      }

      if (url.pathname === "/api/admin/fix-tracking-encoding" && request.method === "POST") {
        const secret = process.env["CRON_SECRET"];
        const auth = request.headers.get("authorization");
        if (secret && auth !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/external.server");
        const { data: orders } = await supabaseAdmin
          .from("orders")
          .select("id, ultimo_evento_rastreio")
          .not("ultimo_evento_rastreio", "is", null);
        let fixed = 0;
        for (const order of orders ?? []) {
          const original = order.ultimo_evento_rastreio as string;
          if (/tr.nsito/i.test(original) && original !== "in_transit") {
            await supabaseAdmin.from("orders").update({ ultimo_evento_rastreio: "in_transit" }).eq("id", order.id);
            fixed++;
          }
        }
        return new Response(`ok: ${fixed} corrigido(s)`, { status: 200 });
      }

      if (url.pathname === "/api/debug/tracking" && request.method === "GET") {
        const meOrderId = url.searchParams.get("order_id");
        if (!meOrderId) return new Response("missing order_id", { status: 400 });
        const token = process.env["MELHOR_ENVIO_TOKEN"];
        if (!token) return new Response("no ME token", { status: 500 });
        const res = await fetch(
          `https://melhorenvio.com.br/api/v2/me/shipment/tracking?orders[]=${encodeURIComponent(meOrderId)}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "solatto/1.0 (solattoecom@gmail.com)" } }
        );
        const text = await res.text();
        return new Response(`status: ${res.status}\n\n${text}`, { status: 200, headers: { "content-type": "text/plain" } });
      }

      if (url.pathname === "/api/cron/check-deliveries" && request.method === "GET") {
        const secret = process.env["CRON_SECRET"];
        const auth = request.headers.get("authorization");
        if (secret && auth !== `Bearer ${secret}`) {
          return new Response("unauthorized", { status: 401 });
        }
        const debug = url.searchParams.get("debug") === "1";
        return await runTrackingCron(debug);
      }

      if (url.pathname === "/api/cron/check-low-stock" && request.method === "GET") {
        const secret = process.env["CRON_SECRET"];
        const auth = request.headers.get("authorization");
        if (secret && auth !== `Bearer ${secret}`) {
          return new Response("unauthorized", { status: 401 });
        }
        return await runLowStockCron();
      }

      if (url.pathname === "/sitemap.xml" && request.method === "GET") {
        return await generateSitemap();
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
