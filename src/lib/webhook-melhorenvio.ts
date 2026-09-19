import { enviarEmailAvaliacao, enviarEmailAtualizacaoRastreio } from "@/lib/email.functions";
import { logger } from "@/lib/logger";

function normalizarStatusME(status: string): string {
  if (!status) return "";
  if (status === "with_carrier" || status === "in transit" || status === "in-transit") return "in_transit";
  if (status === "delivered" || status === "entregue") return "delivered";
  if (status === "posted" || status === "postado") return "posted";
  if (status === "undelivered") return "undelivered";
  return status;
}

type MEWebhookPayload = {
  event?: string;
  order?: {
    id?: string;
    status?: string;
    tracking?: string;
    delivered_at?: string | null;
    message?: string;
  };
};

export async function handleMelhorEnvioWebhook(request: Request): Promise<Response> {
  try {
    const secret = process.env["ME_WEBHOOK_SECRET"];
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (secret && token !== secret) {
      logger.warn("webhook-me", "token inválido");
      return new Response("unauthorized", { status: 401 });
    }

    const body = await request.json() as MEWebhookPayload;
    logger.info("webhook-me", "evento recebido", { event: body.event, order: body.order?.id });

    const meOrderId = body.order?.id;
    if (!meOrderId) return new Response("no order id", { status: 200 });

    const novoStatus = body.order?.status?.toLowerCase() ?? "";
    const entregue = !!body.order?.delivered_at || novoStatus === "delivered" || novoStatus === "entregue";
    const evento = normalizarStatusME(novoStatus) || null;

    if (!evento && !entregue) return new Response("no tracking data", { status: 200 });

    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, usuario_id, status, ultimo_evento_rastreio, codigo_rastreio, order_items(products(nome, slug))")
      .eq("me_order_id", meOrderId)
      .single();

    if (!order) {
      logger.warn("webhook-me", "pedido não encontrado", { meOrderId });
      return new Response("ok", { status: 200 });
    }

    if (entregue && order.status !== "entregue") {
      await supabaseAdmin
        .from("orders")
        .update({ status: "entregue", ultimo_evento_rastreio: evento ?? order.ultimo_evento_rastreio })
        .eq("id", order.id);

      const { data: profile } = await supabaseAdmin
        .from("profiles").select("nome, email").eq("id", order.usuario_id).single();

      if (profile?.email) {
        const itens = ((order.order_items ?? []) as { products: { nome: string; slug: string } | null }[])
          .filter((i) => i.products)
          .map((i) => ({ nome: i.products!.nome, slug: i.products!.slug }));
        void enviarEmailAvaliacao({ email: profile.email, nome: profile.nome, pedido_id: order.id, itens }).catch(() => {});
      }

      logger.info("webhook-me", "pedido marcado como entregue", { orderId: order.id });
      return new Response("ok", { status: 200 });
    }

    if (evento && evento !== order.ultimo_evento_rastreio) {
      await supabaseAdmin.from("orders").update({ ultimo_evento_rastreio: evento }).eq("id", order.id);

      const { data: profile } = await supabaseAdmin
        .from("profiles").select("nome, email").eq("id", order.usuario_id).single();

      if (profile?.email) {
        void enviarEmailAtualizacaoRastreio({
          email: profile.email,
          nome: profile.nome,
          pedido_id: order.id,
          evento,
          codigo_rastreio: order.codigo_rastreio ?? "",
        }).catch(() => {});
      }

      logger.info("webhook-me", "rastreio atualizado", { orderId: order.id, evento });
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    logger.error("webhook-me", "erro inesperado", { error: String(err) });
    return new Response("error", { status: 500 });
  }
}
