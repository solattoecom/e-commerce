import { createServerFn } from "@tanstack/react-start";
import { Resend } from "resend";

const FROM = "Solatto <pedidos@solatto.com.br>";

function getResend() {
  const key = process.env["RESEND_API_KEY"];
  if (!key) throw new Error("RESEND_API_KEY não configurada.");
  return new Resend(key);
}

const statusLabels: Record<string, string> = {
  pendente:  "Pendente",
  pago:      "Pagamento confirmado",
  separando: "Separando seu pedido",
  enviado:   "Pedido enviado",
  entregue:  "Pedido entregue",
  cancelado: "Pedido cancelado",
};

const statusDescricao: Record<string, string> = {
  pendente:  "Recebemos seu pedido e estamos aguardando a confirmação do pagamento.",
  pago:      "Seu pagamento foi confirmado! Em breve começaremos a separar seu pedido.",
  separando: "Estamos separando e embalando seu pedido com cuidado.",
  enviado:   "Seu pedido foi enviado e está a caminho!",
  entregue:  "Seu pedido foi entregue. Esperamos que goste!",
  cancelado: "Seu pedido foi cancelado. Em caso de dúvidas, entre em contato conosco.",
};

function baseTemplate(conteudo: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Solatto</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#000000;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.15em;">SOLATTO</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${conteudo}
          </td>
        </tr>
        <tr>
          <td style="background:#f5f5f5;padding:20px 32px;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-size:12px;color:#999999;text-align:center;">
              Solatto Calçados · solatto.com.br<br/>
              Dúvidas? Responda este e-mail.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

type ConfirmacaoInput = {
  email: string;
  nome: string;
  pedido_id: string;
  total: number;
  itens: { nome: string; tamanho?: string | null; quantidade: number; preco: number }[];
};

type StatusInput = {
  email: string;
  nome: string;
  pedido_id: string;
  status: string;
  codigo_rastreio?: string | null;
};

export async function enviarConfirmacaoPedido(data: ConfirmacaoInput) {
  const resend = getResend();
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const itensHtml = data.itens.map((item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
        <p style="margin:0;font-size:14px;font-weight:600;">${item.nome}</p>
        ${item.tamanho ? `<p style="margin:2px 0 0;font-size:12px;color:#888;">Nº ${item.tamanho}</p>` : ""}
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;">
        ${item.quantidade}x ${brl(item.preco)}
      </td>
    </tr>
  `).join("");

  const html = baseTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">Pedido recebido!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;">
      Olá, ${data.nome}! Recebemos seu pedido e já estamos cuidando dele.
    </p>

    <div style="background:#f9f9f9;border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Número do pedido</p>
      <p style="margin:0;font-size:18px;font-weight:700;font-family:monospace;">#${data.pedido_id.slice(0, 8).toUpperCase()}</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      ${itensHtml}
      <tr>
        <td style="padding:12px 0 0;font-weight:700;font-size:15px;">Total</td>
        <td style="padding:12px 0 0;font-weight:700;font-size:15px;text-align:right;">${brl(data.total)}</td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:14px;color:#555;">
      Você receberá atualizações sobre o status do seu pedido por e-mail.
    </p>
  `);

  await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `Pedido #${data.pedido_id.slice(0, 8).toUpperCase()} recebido — Solatto`,
    html,
  });
}

export async function enviarStatusPedido(data: StatusInput) {
  const resend = getResend();
  const label = statusLabels[data.status] ?? data.status;
  const descricao = statusDescricao[data.status] ?? "";

  const rastreioHtml = data.codigo_rastreio ? `
    <div style="background:#f9f9f9;border-radius:10px;padding:16px;margin-top:20px;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Código de rastreio</p>
      <p style="margin:0 0 12px;font-size:16px;font-weight:700;font-family:monospace;">${data.codigo_rastreio}</p>
      <a href="https://www.linketrack.com/trace/${data.codigo_rastreio}"
         style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;">
        Rastrear pedido
      </a>
    </div>
  ` : "";

  const html = baseTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">${label}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;">
      Olá, ${data.nome}! ${descricao}
    </p>

    <div style="background:#f9f9f9;border-radius:10px;padding:16px;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Número do pedido</p>
      <p style="margin:0;font-size:18px;font-weight:700;font-family:monospace;">#${data.pedido_id.slice(0, 8).toUpperCase()}</p>
    </div>

    ${rastreioHtml}

    <p style="margin:24px 0 0;font-size:14px;color:#555;">
      Qualquer dúvida, basta responder este e-mail.
    </p>
  `);

  await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `Pedido #${data.pedido_id.slice(0, 8).toUpperCase()} — ${label} · Solatto`,
    html,
  });
}

type AvaliacaoInput = {
  email: string;
  nome: string;
  pedido_id: string;
  itens: { nome: string; slug: string }[];
};

export async function enviarEmailAvaliacao(data: AvaliacaoInput) {
  const resend = getResend();

  const itensHtml = data.itens.map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
        <p style="margin:0;font-size:14px;font-weight:600;">${item.nome}</p>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;">
        <a href="https://www.solatto.com.br/produto/${item.slug}#avaliacoes"
           style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:7px 16px;border-radius:20px;font-size:12px;font-weight:600;">
          Avaliar
        </a>
      </td>
    </tr>
  `).join("");

  const html = baseTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">Como foi sua experiência?</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;">
      Olá, ${data.nome}! Seu pedido foi entregue. Que tal deixar uma avaliação dos produtos?
      Sua opinião ajuda outros clientes a escolherem melhor.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${itensHtml}
    </table>

    <p style="margin:0;font-size:13px;color:#999;">
      Obrigado por comprar na Solatto!
    </p>
  `);

  await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `Como foi seu pedido #${data.pedido_id.slice(0, 8).toUpperCase()}? Avalie seus produtos · Solatto`,
    html,
  });
}

export const enviarEmailConfirmacaoPedido = createServerFn({ method: "POST" })
  .inputValidator((input: ConfirmacaoInput) => input)
  .handler(async ({ data }) => { await enviarConfirmacaoPedido(data); });

export const enviarEmailStatusPedido = createServerFn({ method: "POST" })
  .inputValidator((input: StatusInput) => input)
  .handler(async ({ data }) => { await enviarStatusPedido(data); });

export const notificarMudancaStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { order_id: string; status: string; codigo_rastreio?: string | null }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, usuario_id, order_items(products(nome, slug))")
      .eq("id", data.order_id)
      .single();

    if (!order) return;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nome, email")
      .eq("id", order.usuario_id)
      .single();

    if (!profile?.email) return;

    await enviarStatusPedido({
      email: profile.email,
      nome: profile.nome,
      pedido_id: data.order_id,
      status: data.status,
      codigo_rastreio: data.codigo_rastreio,
    });

    if (data.status === "entregue") {
      const itens = ((order.order_items ?? []) as { products: { nome: string; slug: string } | null }[])
        .filter((i) => i.products)
        .map((i) => ({ nome: i.products!.nome, slug: i.products!.slug }));

      await enviarEmailAvaliacao({
        email: profile.email,
        nome: profile.nome,
        pedido_id: data.order_id,
        itens,
      });
    }
  });

type EstoqueDisponivelInput = {
  produto_id: string;
  produto_nome: string;
  produto_slug: string;
  tamanho: string;
};

export const enviarEmailAvaliacaoPedido = createServerFn({ method: "POST" })
  .inputValidator((input: AvaliacaoInput) => input)
  .handler(async ({ data }) => { await enviarEmailAvaliacao(data); });

export const enviarEmailEstoqueDisponivel = createServerFn({ method: "POST" })
  .inputValidator((input: EstoqueDisponivelInput) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: alertas } = await supabaseAdmin
      .from("stock_alerts" as never)
      .select("id, nome, email")
      .eq("produto_id", data.produto_id)
      .eq("tamanho", data.tamanho);

    if (!alertas || (alertas as { id: string; nome: string; email: string }[]).length === 0) return;

    const resend = getResend();
    const url = `https://solatto.com.br/produto/${data.produto_slug}`;
    const lista = alertas as { id: string; nome: string; email: string }[];

    await Promise.all(
      lista.map(({ nome, email }) =>
        resend.emails.send({
          from: FROM,
          to: email,
          subject: `${data.produto_nome} tamanho ${data.tamanho} chegou! · Solatto`,
          html: baseTemplate(`
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">Chegou!</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#555;">
              Olá, ${nome}! O produto que você queria voltou ao estoque.
            </p>
            <div style="background:#f9f9f9;border-radius:10px;padding:16px;margin-bottom:24px;">
              <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Produto</p>
              <p style="margin:0;font-size:16px;font-weight:700;">${data.produto_nome}</p>
              <p style="margin:4px 0 0;font-size:14px;color:#555;">Tamanho ${data.tamanho}</p>
            </div>
            <a href="${url}"
               style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 28px;border-radius:24px;font-size:14px;font-weight:700;letter-spacing:0.05em;">
              Comprar agora
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#999;">
              Corra! O estoque pode esgotar rapidamente.
            </p>
          `),
        }),
      ),
    );

    await supabaseAdmin
      .from("stock_alerts" as never)
      .delete()
      .in("id", lista.map((a) => a.id));
  });
