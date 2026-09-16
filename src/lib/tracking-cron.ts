import { enviarEmailAvaliacao, enviarEmailAtualizacaoRastreio } from "@/lib/email.functions";

type METrackingEvento = {
  status: string;
  description?: string;
};

type METrackingItem = {
  events?: METrackingEvento[];
  status?: string;
};

type METrackingResposta = Record<string, METrackingItem>;

async function consultarME(meOrderId: string): Promise<{ entregue: boolean; evento: string | null }> {
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
    const body = await res.text();
    console.log(`[ME tracking] status=${res.status} content-type=${contentType} body=${body.slice(0, 300)}`);
    if (!res.ok || !contentType.includes("application/json")) return { entregue: false, evento: null };
    const data = JSON.parse(body) as METrackingResposta;
    const item = data[meOrderId];
    if (!item) return { entregue: false, evento: null };

    const status = item.status?.toLowerCase() ?? "";
    const entregue =
      status === "delivered" ||
      status === "entregue" ||
      (item.events ?? []).some(
        (e) =>
          e.status?.toLowerCase() === "delivered" ||
          e.description?.toLowerCase().includes("entregue ao destinat"),
      );

    const eventos = item.events ?? [];
    const ultimo = eventos[eventos.length - 1];
    const evento = ultimo?.description ?? ultimo?.status ?? null;

    return { entregue, evento };
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
    if (!res.ok) return { entregue: false, evento: null };
    const data = (await res.json()) as {
      objeto?: { evento?: { descricao?: string; tipo?: string; detalhe?: string }[] }[];
    };
    const eventos = data.objeto?.[0]?.evento ?? [];
    if (eventos.length === 0) return { entregue: false, evento: null };

    const entregue = eventos.some(
      (e) =>
        e.descricao?.toLowerCase().includes("entregue ao destinatário") ||
        e.tipo === "BDE" ||
        e.tipo === "BDES",
    );

    const ultimo = eventos[0];
    const evento = ultimo?.descricao ?? null;

    return { entregue, evento };
  } catch {
    return { entregue: false, evento: null };
  }
}

export async function runTrackingCron(): Promise<Response> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, usuario_id, codigo_rastreio, me_order_id, ultimo_evento_rastreio, order_items(products(nome, slug))")
      .eq("status", "enviado")
      .not("codigo_rastreio", "is", null);

    if (!orders || orders.length === 0) return new Response("no orders", { status: 200 });

    let updated = 0;

    for (const order of orders) {
      const codigo = order.codigo_rastreio!;
      const meOrderId = (order as { me_order_id?: string | null }).me_order_id ?? null;

      let entregue = false;
      let evento: string | null = null;

      if (meOrderId) {
        const me = await consultarME(meOrderId);
        entregue = me.entregue;
        evento = me.evento;
      }

      if (!entregue && !evento) {
        const correios = await consultarCorreios(codigo);
        entregue = correios.entregue;
        evento = correios.evento;
      }

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
        continue;
      }

      if (!evento) continue;

      const ultimoConhecido = (order as { ultimo_evento_rastreio?: string | null }).ultimo_evento_rastreio ?? null;
      if (evento === ultimoConhecido) continue;

      await supabaseAdmin.from("orders").update({ ultimo_evento_rastreio: evento }).eq("id", order.id);

      const { data: profile } = await supabaseAdmin
        .from("profiles").select("nome, email").eq("id", order.usuario_id).single();

      if (profile?.email && ultimoConhecido !== null) {
        void enviarEmailAtualizacaoRastreio({
          email: profile.email,
          nome: profile.nome,
          pedido_id: order.id,
          evento,
          codigo_rastreio: codigo,
        }).catch(() => {});
      }
    }

    return new Response(`ok: ${updated} entregue(s)`, { status: 200 });
  } catch (err) {
    console.error("[cron-rastreio]", err);
    return new Response("error", { status: 500 });
  }
}
