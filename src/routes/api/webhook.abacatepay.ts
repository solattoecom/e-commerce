import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createTransport } from "nodemailer";

export const APIRoute = createAPIFileRoute("/api/webhook/abacatepay")({
  POST: async ({ request }) => {
    try {
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

      if (body.event !== "billing.paid" && body.data?.billing?.status !== "PAID") {
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
        const transporter = createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: process.env["GMAIL_USER"],
            pass: process.env["GMAIL_APP_PASSWORD"],
          },
        });

        await transporter.sendMail({
          from: `"Solatto" <${process.env["GMAIL_USER"]}>`,
          to: profile.email,
          subject: "Pedido confirmado — Solatto",
          html: `
            <h2>Olá, ${profile.nome}!</h2>
            <p>Seu pagamento foi confirmado e seu pedido está sendo preparado.</p>
            <p><strong>Número do pedido:</strong> ${order.id.slice(0, 8).toUpperCase()}</p>
            <p><strong>Total:</strong> R$ ${order.total.toFixed(2).replace(".", ",")}</p>
            <p>Acompanhe o status em <a href="https://e-commerce-rnfpag7k6-solattoecom-1856.vercel.app/pedidos">Meus Pedidos</a>.</p>
            <p>Obrigado pela compra!</p>
          `,
        });
      }

      return new Response("ok", { status: 200 });
    } catch (err) {
      console.error("[webhook] erro:", err);
      return new Response("error", { status: 500 });
    }
  },
});
