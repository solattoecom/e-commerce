import { createServerFn } from "@tanstack/react-start";
import { Resend } from "resend";

function getResend() {
  const key = process.env["RESEND_API_KEY"];
  if (!key) throw new Error("RESEND_API_KEY não configurada.");
  return new Resend(key);
}

export const assinarNewsletter = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");
    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .insert({ email: data.email.trim().toLowerCase() });
    if (error) {
      if (error.code === "23505") throw new Error("Este e-mail já está inscrito.");
      throw new Error(error.message);
    }
  });

export const notificarNovoProduto = createServerFn({ method: "POST" })
  .inputValidator((input: {
    nome: string;
    descricao: string | null;
    slug: string;
    preco: number | null;
  }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");
    const { data: subscribers } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("email");
    if (!subscribers?.length) return;

    const resend = getResend();
    const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const url = "https://solatto.com.br/produto/" + data.slug;

    const btnStyle = "display:inline-block;background:#000000;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:24px;font-size:14px;font-weight:600;font-family:sans-serif;";
    const html =
      "<!DOCTYPE html><html><head><meta charset=UTF-8></head>" +
      "<body style=\"margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;\">" +
      "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f5f5f5;padding:40px 16px;\"><tr><td align=\"center\">" +
      "<table width=\"100%\" style=\"max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;\"><tr>" +
      "<td style=\"background:#000000;padding:24px 32px;\"><p style=\"margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:3px;\">SOLATTO</p></td></tr><tr>" +
      "<td style=\"padding:32px;\">" +
      "<p style=\"margin:0 0 4px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:2px;\">Novidade</p>" +
      "<h1 style=\"margin:0 0 12px;font-size:22px;font-weight:700;\">" + data.nome + "</h1>" +
      (data.descricao ? "<p style=\"margin:0 0 20px;font-size:15px;color:#555;\">" + data.descricao + "</p>" : "") +
      (data.preco ? "<p style=\"margin:0 0 24px;font-size:20px;font-weight:700;\">" + brl(data.preco) + "</p>" : "") +
      "<a href=\"" + url + "\" style=\"" + btnStyle + "\">Ver produto</a>" +
      "<p style=\"margin:24px 0 0;font-size:13px;color:#999;\">Voce esta recebendo este e-mail por ser assinante da newsletter Solatto.</p>" +
      "</td></tr><tr>" +
      "<td style=\"background:#f5f5f5;padding:20px 32px;border-top:1px solid #eeeeee;text-align:center;font-size:12px;color:#999999;\">Solatto Calcados &middot; solatto.com.br</td>" +
      "</tr></table></td></tr></table></body></html>";

    const emails = subscribers.map((s) => ({
      from: "Solatto <noreply@solatto.com.br>",
      to: s.email,
      subject: "Novidade na Solatto: " + data.nome,
      html,
    }));

    await resend.batch.send(emails);
  });
