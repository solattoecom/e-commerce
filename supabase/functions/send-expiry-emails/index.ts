import { createClient } from "npm:@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Solatto <pedidos@solatto.com.br>";

function htmlTemplate(conteudo: string) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
<tr><td align="center"><table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#000000;padding:24px 32px;"><p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.15em;">SOLATTO</p></td></tr>
<tr><td style="padding:32px;">${conteudo}</td></tr>
<tr><td style="background:#f5f5f5;padding:20px 32px;border-top:1px solid #eeeeee;">
<p style="margin:0;font-size:12px;color:#999999;text-align:center;">Solatto Calçados · solatto.com.br<br/>Dúvidas? Responda este e-mail.</p>
</td></tr></table></td></tr></table></body></html>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: orders } = await supabase
    .from("orders")
    .select("id, payment_method, usuario_id")
    .eq("status", "expirado")
    .is("expiry_notified_at", null)
    .limit(50);

  if (!orders?.length) return new Response(JSON.stringify({ notified: 0 }), { status: 200 });

  let notified = 0;
  for (const order of orders) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, email")
        .eq("id", order.usuario_id)
        .single();

      if (profile?.email) {
        const metodo = order.payment_method === "pix" ? "PIX" : order.payment_method === "boleto" ? "boleto" : "pagamento";
        const nome = profile.nome ?? "Cliente";
        const numPedido = order.id.slice(0, 8).toUpperCase();
        const html = htmlTemplate(`
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">Seu ${metodo} expirou</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#555;">Olá, ${nome}! O prazo para pagamento do seu pedido encerrou e ele foi cancelado automaticamente.</p>
          <div style="background:#f9f9f9;border-radius:10px;padding:16px;margin-bottom:24px;">
            <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Número do pedido</p>
            <p style="margin:0;font-size:18px;font-weight:700;font-family:monospace;">#${numPedido}</p>
          </div>
          <p style="margin:0 0 20px;font-size:14px;color:#555;">Os itens foram devolvidos ao estoque. Se ainda quiser os produtos, é só fazer um novo pedido.</p>
          <a href="https://solatto.com.br" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:20px;font-size:14px;font-weight:600;">Fazer novo pedido</a>
          <p style="margin:24px 0 0;font-size:13px;color:#999;">Qualquer dúvida, basta responder este e-mail.</p>
        `);
        await sendEmail(profile.email, `Pedido #${numPedido} expirado — Solatto`, html);
      }

      await supabase
        .from("orders")
        .update({ expiry_notified_at: new Date().toISOString() } as Record<string, unknown>)
        .eq("id", order.id);

      notified++;
    } catch {
      // continua para o próximo pedido
    }
  }

  return new Response(JSON.stringify({ notified }), { status: 200, headers: { "Content-Type": "application/json" } });
});
