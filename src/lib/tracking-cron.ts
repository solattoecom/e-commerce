import { enviarEmailAvaliacao } from "@/lib/email.functions";

type METrackingItem = {
  status?: string;
  delivered_at?: string | null;
};

type METrackingResposta = Record<string, METrackingItem>;

async function consultarME(meOrderId: string): Promise<{ entregue: boolean; evento: string | null; raw?: string }> {
  const token = process.env["MELHOR_ENVIO_TOKEN"];
  if (!token || !meOrderId) return { entregue: false, evento: null };
  try {
    const res = await fetch(
      `https://melhorenvio.com.br/api/v2/me/shipment/tracking`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "solatto/1.0 (solattoecom@gmail.com)",
        },
        body: JSON.stringify({ orders: [meOrderId] }),
        signal: AbortSignal.timeout(8000),
      },
    );
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("application/json")) return { entregue: false, evento: null };
    const data = (await res.json()) as METrackingResposta;
    const raw = JSON.stringify(data);
    const item = data[meOrderId];
    if (!item) return { entregue: false, evento: null, raw };

    const status = item.status?.toLowerCase() ?? "";
    const entregue = !!item.delivered_at || status === "delivered" || status === "entregue";
    const evento = status || null;

    return { entregue, evento, raw };
  } catch {
    return { entregue: false, evento: null };
  }
}

async function consultarCorreios(codigo: string): Promise<{ entregue: boolean; evento: string | null }> {
  try {
    const res = await fetch(`https://proxyapp.correios.com.br/v1/sro-rastro/${codigo}`, {
      headers: { Accept: "application/json", "User-Agent": "solatto/1.0 (solattoecom@gmail.com)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[correios] HTTP ${res.status} para código ${codigo}`);
      return { entregue: false, evento: null };
    }
    const data = (await res.json()) as {
      objeto?: { evento?: { descricao?: string; tipo?: string; detalhe?: string }[] }[];
    };
    const eventos = data.objeto?.[0]?.evento ?? [];
    if (eventos.length === 0) return { entregue: false, evento: null };

    const entregue = eventos.some(
      (e) =>
        e.descricao?.toLowerCase().includes("entregue ao destinatário") ||
        e.descricao?.toLowerCase().includes("objeto entregue") ||
        e.tipo === "BDE" ||
        e.tipo === "BDES",
    );

    const ultimo = eventos[0];
    const evento = ultimo?.descricao ?? null;

    return { entregue, evento };
  } catch (err) {
    console.warn(`[correios] erro ao consultar ${codigo}:`, String(err));
    return { entregue: false, evento: null };
  }
}

export async function runTrackingCron(debug = false): Promise<Response> {
  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, usuario_id, codigo_rastreio, me_order_id, ultimo_evento_rastreio, order_items(products(nome, slug))")
      .eq("status", "enviado")
      .not("codigo_rastreio", "is", null);

    if (!orders || orders.length === 0) return new Response("no orders", { status: 200 });

    log(`pedidos: ${orders.length}`);

    let updated = 0;

    for (const order of orders) {
      const codigo = order.codigo_rastreio!;
      const meOrderId = (order as { me_order_id?: string | null }).me_order_id ?? null;
      const ultimoConhecido = (order as { ultimo_evento_rastreio?: string | null }).ultimo_evento_rastreio ?? null;

      let entregue = false;

      if (meOrderId) {
        const me = await consultarME(meOrderId);
        entregue = me.entregue;
        log(`pedido ${order.id} | ME => entregue=${entregue}`);
      }

      if (!entregue) {
        const correios = await consultarCorreios(codigo);
        if (correios.entregue) entregue = true;
        log(`pedido ${order.id} | Correios => entregue=${correios.entregue}`);
      }

      if (!entregue) { log(`pedido ${order.id} | não entregue, pulando`); continue; }

      if (entregue) {
        await supabaseAdmin.from("orders").update({ status: "entregue" }).eq("id", order.id);
        updated++;

        const { data: profile } = await supabaseAdmin
          .from("profiles").select("nome, email").eq("id", order.usuario_id).single();

        if (profile?.email) {
          const itens = ((order.order_items ?? []) as { products: { nome: string; slug: string } | null }[])
            .filter((i) => i.products)
            .map((i) => ({ nome: i.products!.nome, slug: i.products!.slug }));
          void enviarEmailAvaliacao({ email: profile.email, nome: profile.nome, pedido_id: order.id, itens }).catch(() => {});
        }
        log(`pedido ${order.id} | marcado como entregue`);
      }

    }

    const resumo = `ok: ${updated} entregue(s)`;
    return new Response(debug ? `${resumo}\n\n${logs.join("\n")}` : resumo, { status: 200 });
  } catch (err) {
    console.error("[cron-rastreio]", err);
    return new Response(debug ? `error\n\n${logs.join("\n")}\n\n${String(err)}` : "error", { status: 500 });
  }
}
