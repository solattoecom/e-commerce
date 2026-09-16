import { enviarConfirmacaoPedido } from "@/lib/email.functions";
import { verifyHmacSha256, validateTimestamp } from "@/lib/webhook-verify";
import { logger } from "@/lib/logger";

export async function handleAbacatePayWebhook(request: Request): Promise<Response> {
  try {
    const secret = process.env["ABACATEPAY_WEBHOOK_SECRET"];
    if (!secret) {
      console.error("[webhook-abacatepay] ABACATEPAY_WEBHOOK_SECRET não configurado");
      return new Response("misconfigured", { status: 500 });
    }

    const rawBody = await request.text();

    // Valida assinatura HMAC-SHA256
    const signature = request.headers.get("x-abacatepay-hmac-sha256") ?? "";
    if (!signature) { logger.warn("webhook-abacatepay", "assinatura ausente"); return new Response("missing signature", { status: 401 }); }
    const valid = await verifyHmacSha256(rawBody, secret, signature);
    if (!valid) { logger.warn("webhook-abacatepay", "assinatura inválida"); return new Response("invalid signature", { status: 401 }); }

    // Valida atualidade (rejeita payloads com mais de 5 min)
    const tsHeader = request.headers.get("x-abacatepay-timestamp");
    if (tsHeader) {
      const ts = Number(tsHeader);
      if (!validateTimestamp(ts)) return new Response("timestamp expired", { status: 401 });
    }

    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const event = body["event"] as string | undefined;
    const bodyData = body["data"] as Record<string, unknown> | undefined;

    const billing = (bodyData?.["pixQrCode"] ?? bodyData?.["billing"] ?? bodyData?.["checkout"] ?? bodyData) as Record<string, unknown> | undefined;
    const status = (billing?.["status"] as string | undefined)?.toUpperCase();
    const isPaid =
      event === "billing.paid" ||
      event === "checkout.completed" ||
      status === "PAID" ||
      status === "COMPLETED";

    if (!isPaid) { logger.info("webhook-abacatepay", "evento ignorado", { event, status }); return new Response("ignored", { status: 200 }); }

    const metadata = billing?.["metadata"] as Record<string, unknown> | undefined;
    const orderId =
      (metadata?.["order_id"] as string | undefined) ??
      (billing?.["externalId"] as string | undefined) ??
      (billing?.["external_id"] as string | undefined);

    const paymentId = billing?.["id"] as string | undefined;

    if (!orderId && !paymentId) return new Response("missing ids", { status: 400 });

    const query = supabaseAdmin
      .from("orders")
      .select("id, usuario_id, total, status");

    const { data: order } = orderId
      ? await query.eq("id", orderId).single()
      : await query.eq("payment_id", paymentId!).single();

    if (!order) { logger.warn("webhook-abacatepay", "pedido não encontrado", { orderId, paymentId }); return new Response("order not found", { status: 404 }); }
    if (order.status === "pago") { logger.info("webhook-abacatepay", "pedido já pago", { orderId: order.id }); return new Response("already paid", { status: 200 }); }

    const { data: updated } = await supabaseAdmin
      .from("orders")
      .update({ status: "pago" })
      .eq("id", order.id)
      .eq("status", "pendente")
      .select("id");
    if (!updated?.length) { logger.info("webhook-abacatepay", "race condition detectada", { orderId: order.id }); return new Response("already paid", { status: 200 }); }
    logger.info("webhook-abacatepay", "pedido marcado como pago", { orderId: order.id });

    const { data: paidOrder } = await supabaseAdmin
      .from("orders")
      .select("coupon_id")
      .eq("id", order.id)
      .single();

    if (paidOrder?.coupon_id) {
      await supabaseAdmin.rpc("increment_coupon_used_count", { p_coupon_id: paidOrder.coupon_id });
    }

    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("variacao_id, quantidade")
      .eq("pedido_id", order.id);

    for (const item of items ?? []) {
      if (!item.variacao_id) continue;
      await supabaseAdmin.rpc("decrement_stock", {
        p_variacao_id: item.variacao_id,
        p_quantidade: item.quantidade,
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nome, email")
      .eq("id", order.usuario_id)
      .single();

    if (profile?.email) {
      const { data: orderItems } = await supabaseAdmin
        .from("order_items")
        .select("quantidade, preco_unitario, products(nome), product_variants(tamanho)")
        .eq("pedido_id", order.id);

      void enviarConfirmacaoPedido({
        email: profile.email,
        nome: profile.nome,
        pedido_id: order.id,
        total: order.total,
        itens: (orderItems ?? []).map((item) => ({
          nome: (item.products as { nome: string } | null)?.nome ?? "Produto",
          tamanho: (item.product_variants as { tamanho: string } | null)?.tamanho ?? null,
          quantidade: item.quantidade,
          preco: item.preco_unitario,
        })),
      }).catch(() => {});
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    logger.error("webhook-abacatepay", "erro inesperado", { error: String(err) });
    return new Response("error", { status: 500 });
  }
}
