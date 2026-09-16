import { Resend } from "npm:resend";

const FROM = "Solatto <noreply@solatto.com.br>";

const CSS = "body{margin:0;padding:0;background:rgb(245,245,245);font-family:sans-serif}" +
  ".wrap{background:rgb(245,245,245);padding:40px 16px}" +
  ".card{max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden}" +
  ".header{background:black;padding:24px 32px}" +
  ".logo{margin:0;color:white;font-size:20px;font-weight:700;letter-spacing:3px}" +
  ".body{padding:32px}" +
  ".footer{background:rgb(245,245,245);padding:20px 32px;border-top:1px solid rgb(238,238,238);text-align:center;font-size:12px;color:rgb(153,153,153)}" +
  "h1{margin:0 0 8px;font-size:22px;font-weight:700}" +
  "p{margin:0 0 24px;font-size:15px;color:rgb(85,85,85)}" +
  ".btn{display:inline-block;background:black;color:white;text-decoration:none;padding:14px 28px;border-radius:50px;font-size:14px;font-weight:600}" +
  ".note{margin-top:24px;font-size:13px;color:rgb(153,153,153)}";

function wrap(body) {
  return "<!DOCTYPE html><html><head><meta charset=UTF-8><style>" +
    CSS +
    "</style></head><body>" +
    "<div class=wrap><div class=card>" +
    "<div class=header><p class=logo>SOLATTO</p></div>" +
    "<div class=body>" + body + "</div>" +
    "<div class=footer>Solatto Calcados · solatto.com.br<br>Duvidas? Responda este e-mail.</div>" +
    "</div></div></body></html>";
}

function btn(href, label) {
  return "<a href=" + href + " class=btn>" + label + "</a>";
}

function buildEmail(type, link) {
  if (type === "signup") {
    return {
      subject: "Confirme seu e-mail - Solatto",
      html: wrap(
        "<h1>Bem-vindo a Solatto!</h1>" +
        "<p>Confirme seu e-mail para ativar sua conta e comecar a comprar.</p>" +
        btn(link, "Confirmar e-mail") +
        "<p class=note>Se nao criou uma conta na Solatto, ignore este e-mail.</p>"
      ),
    };
  }
  if (type === "recovery") {
    return {
      subject: "Redefinir senha - Solatto",
      html: wrap(
        "<h1>Redefinir senha</h1>" +
        "<p>Recebemos uma solicitacao para redefinir a senha da sua conta.</p>" +
        btn(link, "Redefinir senha") +
        "<p class=note>Se nao solicitou a redefinicao, ignore este e-mail. O link expira em 1 hora.</p>"
      ),
    };
  }
  if (type === "email_change") {
    return {
      subject: "Confirmar novo e-mail - Solatto",
      html: wrap(
        "<h1>Confirmar novo e-mail</h1>" +
        "<p>Clique no botao abaixo para confirmar seu novo endereco de e-mail.</p>" +
        btn(link, "Confirmar novo e-mail")
      ),
    };
  }
  if (type === "invite") {
    return {
      subject: "Voce foi convidado - Solatto",
      html: wrap(
        "<h1>Convite Solatto</h1>" +
        "<p>Voce foi convidado a criar uma conta na Solatto.</p>" +
        btn(link, "Aceitar convite")
      ),
    };
  }
  return null;
}

const JSON_OK = new Response(JSON.stringify({}), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

Deno.serve(async function(req) {
  try {
    const payload = await req.json();
    const user = payload.user;
    const email_data = payload.email_data;
    const type = email_data.email_action_type;
    const link = email_data.site_url +
      "/auth/v1/verify?token=" +
      email_data.token_hash +
      "&type=" +
      type +
      "&redirect_to=" +
      email_data.redirect_to;

    const result = buildEmail(type, link);
    if (result) {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");
      await resend.emails.send({
        from: FROM,
        to: user.email,
        subject: result.subject,
        html: result.html,
      });
    }
  } catch (err) {
    console.error("Erro no hook:", err);
  }
  return JSON_OK;
});
