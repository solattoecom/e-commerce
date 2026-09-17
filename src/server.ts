import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleAbacatePayWebhook } from "./lib/webhook-abacatepay";
import { handleAsaasWebhook } from "./lib/webhook-asaas";
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

    const base = "https://solatto.com.br";
    const staticPages = [
      { url: base, priority: "1.0", changefreq: "daily" },
      { url: `${base}/login`, priority: "0.3", changefreq: "yearly" },
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

      if (url.pathname === "/api/webhook/asaas" && request.method === "POST") {
        return await handleAsaasWebhook(request);
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
