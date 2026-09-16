type AsaasPayment = {
  id: string;
  externalReference?: string;
  status: string;
  value: number;
};

type AsaasWebhookBody = {
  event: string;
  payment: AsaasPayment;
};

export async function handleAsaasWebhook(request: Request): Promise<Response> {
  try {
    const token = process.env["ASAAS_WEBHOOK_TOKEN"];
    if (!token) {
      console.error("[webhook-asaas] ASAAS_WEBHOOK_TOKEN não configurado");
      return new Response("misconfigured", { status: 500 });
    }

    const received = request.headers.get("asaas-access-token");
    if (!received || received !== token) {
      return new Response("unauthorized", { status: 401 });
    }

    const body = await request.json() as AsaasWebhookBody;
    const { event, payment } = body;

    if (!["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(event)) {
      return new Response("ignored", { status: 200 });
    }

    const orderId = payment.externalReference;
    if (!orderId) return new Response("no reference", { status: 200 });

    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .single();

    if (!order || order.status === "pago") return new Response("ok", { status: 200 });

    await supabaseAdmin.from("orders").update({ status: "pago" }).eq("id", orderId);

    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("variacao_id, quantidade")
      .eq("pedido_id", orderId);

    for (const item of items ?? []) {
      if (!item.variacao_id) continue;
      await supabaseAdmin.rpc("decrement_stock", {
        p_variacao_id: item.variacao_id,
        p_quantidade: item.quantidade,
      });
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[webhook-asaas]", err);
    return new Response("error", { status: 500 });
  }
}
