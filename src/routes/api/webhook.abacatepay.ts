import { createAPIFileRoute } from "@tanstack/react-start/api";
import { enviarConfirmacaoPedido } from "@/lib/email.functions";

export const APIRoute = createAPIFileRoute("/api/webhook/abacatepay")({
  POST: async ({ request }) => {
    try {
      // Log all headers for debugging
      const headersLog: Record<string, string> = {};
      request.headers.forEach((value, key) => { headersLog[key] = value; });
      console.log("[webhook] headers:", JSON.stringify(headersLog));

      const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

      const body = await request.json() as Record<string, unknown>;
      console.log("[webhook] payload:", JSON.stringify(body));

      const event = body.event as string | undefined;
      const bodyData = body.data as Record<string, unknown> | undefined;

      // Suporte a billing.paid e checkout.completed (AbacatePay v2)
      const billing = (bodyData?.billing ?? bodyData?.checkout ?? bodyData) as Record<string, unknown> | undefined;
      const status = (billing?.status as string | undefined)?.toUpperCase();
      const isPaid =
        event === "billing.paid" ||
        event === "checkout.completed" ||
        status === "PAID" ||
        status === "COMPLETED";

      if (!isPaid) {
        console.log("[webhook] evento ignorado:", event, status);
        return new Response("ignored", { status: 200 });
      }

      // Tenta obter order_id via metadata ou externalId
      const metadata = billing?.metadata as Record<string, unknown> | undefined;
      const orderId =
        (metadata?.order_id as string | undefined) ??
        (billing?.externalId as string | undefined) ??
        (billing?.external_id as string | undefined);

      const paymentId = billing?.id as string | undefined;

      console.log("[webhook] orderId:", orderId, "paymentId:", paymentId);

      if (!orderId && !paymentId) {
        console.error("[webhook] sem orderId nem paymentId");
        return new Response("missing ids", { status: 400 });
      }

      const query = supabaseAdmin
        .from("orders")
        .select("id, usuario_id, total, status")
        .eq("status", "pendente");

      const { data: order } = orderId
        ? await query.eq("id", orderId).single()
        : await query.eq("payment_id", paymentId!).single();

      if (!order) return new Response("order not found", { status: 404 });
      if (order.status === "pago") return new Response("already paid", { status: 200 });

      await supabaseAdmin
        .from("orders")
        .update({ status: "pago" })
        .eq("id", order.id);

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
      console.error("[webhook] erro:", err);
      return new Response("error", { status: 500 });
    }
  },
});
