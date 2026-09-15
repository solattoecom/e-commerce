const ADMIN_EMAIL = "solattoecom@gmail.com";
const LOW_STOCK_THRESHOLD = 3;
const FROM = "Solatto <pedidos@solatto.com.br>";

export async function runLowStockCron(): Promise<Response> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");
    const { Resend } = await import("resend");

    const { data: variants } = await supabaseAdmin
      .from("product_variants")
      .select("id, tamanho, estoque, produto_id, products(nome, slug)")
      .lte("estoque", LOW_STOCK_THRESHOLD)
      .order("estoque", { ascending: true });

    if (!variants || variants.length === 0) {
      return new Response("ok — no low stock", { status: 200 });
    }

    type Variant = {
      id: string;
      tamanho: string;
      estoque: number;
      produto_id: string;
      products: { nome: string; slug: string } | null;
    };

    const rows = variants as unknown as Variant[];

    const linhas = rows
      .map(
        (v) =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${v.products?.nome ?? v.produto_id}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${v.tamanho}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:700;color:${v.estoque === 0 ? "#e53e3e" : "#d97706"};">${v.estoque === 0 ? "Esgotado" : v.estoque}</td>
          </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#000000;padding:24px 32px;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.15em;">SOLATTO</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">Alerta de estoque baixo</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#555;">
            Os seguintes produtos estão com estoque igual ou inferior a ${LOW_STOCK_THRESHOLD} unidades.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#f9f9f9;">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#888;text-transform:uppercase;">Produto</th>
                <th style="padding:8px 12px;text-align:center;font-size:12px;color:#888;text-transform:uppercase;">Tamanho</th>
                <th style="padding:8px 12px;text-align:center;font-size:12px;color:#888;text-transform:uppercase;">Estoque</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
          <p style="margin:24px 0 0;font-size:13px;color:#888;">
            Acesse o <a href="https://solatto.com.br/admin" style="color:#000;">painel admin</a> para atualizar o estoque.
          </p>
        </td></tr>
        <tr><td style="background:#f5f5f5;padding:20px 32px;border-top:1px solid #eeeeee;">
          <p style="margin:0;font-size:12px;color:#999;text-align:center;">Solatto Calçados · solatto.com.br</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const key = process.env["RESEND_API_KEY"];
    if (!key) throw new Error("RESEND_API_KEY não configurada.");
    const resend = new Resend(key);

    await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `⚠️ Alerta de estoque baixo — ${rows.length} variação(ões) · Solatto`,
      html,
    });

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("low-stock-cron error:", err);
    return new Response("error", { status: 500 });
  }
}
