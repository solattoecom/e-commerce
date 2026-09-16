import { logger } from "@/lib/logger";

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
      logger.warn("webhook-asaas", "token inválido");
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

    if (!order) { logger.warn("webhook-asaas", "pedido não encontrado", { orderId }); return new Response("ok", { status: 200 }); }
    if (order.status === "pago") { logger.info("webhook-asaas", "pedido já pago", { orderId }); return new Response("ok", { status: 200 }); }

    await supabaseAdmin.from("orders").update({ status: "pago" }).eq("id", orderId);

    return new Response("ok", { status: 200 });
  } catch (err) {
    logger.error("webhook-asaas", "erro inesperado", { error: String(err) });
    return new Response("error", { status: 500 });
  }
}
