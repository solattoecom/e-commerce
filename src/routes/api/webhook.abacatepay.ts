import { createAPIFileRoute } from "@tanstack/react-start/api";
import { enviarConfirmacaoPedido } from "@/lib/email.functions";

export const APIRoute = createAPIFileRoute("/api/webhook/abacatepay")({
  POST: async ({ request }) => {
    try {
      const secret = process.env["ABACATEPAY_WEBHOOK_SECRET"];
      if (secret) {
        const signature = request.headers.get("x-webhook-secret") ?? request.headers.get("x-abacatepay-signature") ?? "";
        if (signature !== secret) {
          return new Response("unauthorized", { status: 401 });
        }
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

      const body = await request.json() as {
        event: string;
        data: {
          billing: {
            id: string;
            status: string;
            metadata?: { order_id?: string };
          };
        };
      };

      const isPaid =
        body.event === "billing.paid" ||
        body.event === "checkout.completed" ||
        body.data?.billing?.status === "PAID";

      if (!isPaid) {
        return new Response("ignored", { status: 200 });
      }

      const paymentId = body.data.billing.id;
      const orderId = body.data.billing.metadata?.order_id;

      const query = supabaseAdmin
        .from("orders")
        .select("id, usuario_id, total, status")
        .eq("status", "pendente");

      const { data: order } = orderId
        ? await query.eq("id", orderId).single()
        : await query.eq("payment_id", paymentId).single();

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
