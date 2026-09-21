import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createClient } from "@supabase/supabase-js";
import { EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_PUBLISHABLE_KEY, createSupabaseFetch } from "@/integrations/supabase/external";
import type { Database } from "@/integrations/supabase/types";

const BASE = "https://solatto.com.br";

const STATIC_PAGES = [
  { url: "/", priority: "1.0", changefreq: "daily" },
  { url: "/sobre", priority: "0.6", changefreq: "monthly" },
  { url: "/termos", priority: "0.4", changefreq: "monthly" },
  { url: "/privacidade", priority: "0.4", changefreq: "monthly" },
];

export const APIRoute = createAPIFileRoute("/api/sitemap.xml")({
  GET: async () => {
    let productEntries = "";
    try {
      const supabase = createClient<Database>(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_PUBLISHABLE_KEY, {
        global: { fetch: createSupabaseFetch(EXTERNAL_SUPABASE_PUBLISHABLE_KEY) },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: products } = await supabase
        .from("products")
        .select("slug, updated_at")
        .eq("ativo", true);

      if (products) {
        productEntries = products.map((p) => `
  <url>
    <loc>${BASE}/produto/${p.slug}</loc>
    <lastmod>${(p.updated_at ?? new Date().toISOString()).slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join("");
      }
    } catch {
      // Se falhar, sitemap só terá páginas estáticas
    }

    const staticEntries = STATIC_PAGES.map((p) => `
  <url>
    <loc>${BASE}${p.url}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries}${productEntries}
</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
});
