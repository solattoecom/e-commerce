import { enviarEmailAvaliacao } from "@/lib/email.functions";

type CorreiosEvento = {
  descricao: string;
  tipo?: string;
  status?: string;
};

type CorreiosResposta = {
  objeto?: {
    numero: string;
    evento?: CorreiosEvento[];
  }[];
};

async function isEntregue(codigo: string): Promise<boolean> {
  try {
    const res = await fetch(`https://proxyapp.correios.com.br/v1/sro-rastro/${codigo}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data = await res.json() as CorreiosResposta;
    const eventos = data.objeto?.[0]?.evento ?? [];
    return eventos.some((e) =>
      e.descricao?.toLowerCase().includes("entregue ao destinatário") ||
      e.tipo === "BDE" ||
      e.tipo === "BDES"
    );
  } catch {
    return false;
  }
}

export async function runTrackingCron(): Promise<Response> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, usuario_id, codigo_rastreio, order_items(products(nome, slug))")
      .eq("status", "enviado")
      .not("codigo_rastreio", "is", null);

    if (!orders || orders.length === 0) return new Response("no orders", { status: 200 });

    let updated = 0;

    for (const order of orders) {
      const entregue = await isEntregue(order.codigo_rastreio!);
      if (!entregue) continue;

      await supabaseAdmin.from("orders").update({ status: "entregue" }).eq("id", order.id);
      updated++;

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("nome, email")
        .eq("id", order.usuario_id)
        .single();

      if (profile?.email) {
        const itens = ((order.order_items ?? []) as { products: { nome: string; slug: string } | null }[])
          .filter((i) => i.products)
          .map((i) => ({ nome: i.products!.nome, slug: i.products!.slug }));

        void enviarEmailAvaliacao({
          email: profile.email,
          nome: profile.nome,
          pedido_id: order.id,
          itens,
        }).catch(() => {});
      }
    }

    return new Response(`ok: ${updated} entregue(s)`, { status: 200 });
  } catch (err) {
    console.error("[cron-rastreio]", err);
    return new Response("error", { status: 500 });
  }
}
