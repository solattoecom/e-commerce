import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Store, Truck } from "lucide-react";
import { signIn, signUpWithType, type ClientType } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/external";
import { isValidEmail } from "@/lib/validate";
import { checkRateLimit, recordRateLimitAttempt } from "@/lib/rate-limit.functions";
import { Button } from "@/components/ui/button";
import heroVideo from "@/assets/hero-calcando-sapato.mp4.asset.json";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar | Solatto" },
      { name: "description", content: "Acesse sua conta Solatto para acompanhar pedidos, favoritos e ofertas exclusivas." },
    ],
  }),
  component: LoginPage,
});

// ── Account types ──────────────────────────────────────────────────────────────

const accountTypes = [
  { id: "varejo", name: "Varejo", Icon: Store },
  { id: "atacado", name: "Atacado", Icon: Building2 },
  { id: "dropshipping", name: "Drops", Icon: Truck },
] as const;

type AccountType = (typeof accountTypes)[number];
type Mode = "login" | "signup" | "forgot" | "reset-sent" | "select-type";

// ── Embedded styles ────────────────────────────────────────────────────────────

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Hanken+Grotesk:wght@300..900&display=swap');

.auth-stage{
  position:fixed;inset:0;z-index:50;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(420px,.85fr);
  background:#0d0f13;color:var(--auth-text);
  font-family:'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;overflow:hidden;
}
.auth-photo{position:relative;min-width:0;overflow:hidden;background:#0d0f13}
.auth-photo-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:58% 50%;display:block}
.auth-scrim{position:absolute;inset:0;background:linear-gradient(180deg,transparent 35%,var(--auth-overlay) 100%)}
.auth-hero{position:absolute;left:clamp(24px,4vw,62px);right:24px;bottom:clamp(28px,5vh,56px)}
.auth-badge{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 12px;border:1px solid color-mix(in oklab,var(--auth-text) 16%,transparent);border-radius:999px;
  background:color-mix(in oklab,var(--auth-canvas) 72%,transparent);backdrop-filter:blur(10px);color:var(--auth-text);white-space:nowrap;
  font-size:11px;font-weight:500;letter-spacing:0;box-shadow:0 6px 20px color-mix(in oklab,var(--auth-canvas) 24%,transparent)}
.auth-hl{margin:18px 0 0;color:var(--auth-text);font-family:'Bricolage Grotesque','Hanken Grotesk',sans-serif;
  font-variation-settings:'wght' 540;font-weight:540;line-height:.98;
  font-size:clamp(38px,4.5vw,68px);letter-spacing:0;text-shadow:0 2px 22px var(--auth-overlay)}
.auth-hl span{display:block}

.auth-pane{min-width:0;display:flex;align-items:center;justify-content:center;padding:clamp(16px,3vw,40px) clamp(28px,5vw,72px);background:var(--auth-canvas);overflow-y:auto}
.auth-card{width:100%;max-width:360px}
.auth-mark{width:38px;height:38px;margin:0 auto 12px;display:grid;place-items:center}
.auth-mark svg{width:38px;height:38px;border-radius:8px}
.auth-h1{margin:0;color:var(--auth-text);font-family:'Bricolage Grotesque','Hanken Grotesk',sans-serif;
  font-variation-settings:'wght' 520;font-weight:520;text-align:center;font-size:25px;letter-spacing:0;line-height:1.1}
.auth-sub{margin:6px 0 0;text-align:center;color:var(--auth-muted);font-size:12px;letter-spacing:0}
.auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin:16px 0 0;padding:3px;border-radius:7px;background:var(--auth-surface)}
.auth-tabs button{height:32px;border:0;border-radius:5px;background:transparent;color:var(--auth-muted);font:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:background .18s ease,color .18s ease}
.auth-tabs button[data-active="true"]{background:var(--auth-surface-strong);color:var(--auth-text);box-shadow:0 1px 4px color-mix(in oklab,var(--auth-canvas) 45%,transparent)}
.auth-fields{display:flex;flex-direction:column;gap:10px;margin-top:14px}
.auth-field-wrap{display:flex;flex-direction:column;gap:6px}
.auth-label{padding-left:2px;color:var(--auth-muted);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.12em}
.auth-field{display:flex;align-items:center;height:42px;border-radius:12px;background:color-mix(in oklab,var(--auth-surface) 72%,transparent);border:1.5px solid transparent;padding:0 12px;transition:background .18s ease,border-color .18s ease}
.auth-field:focus-within{background:var(--auth-surface);border-color:var(--auth-text)}
.auth-field input{width:100%;border:0;outline:0;background:transparent;color:var(--auth-text);font:inherit;font-size:14px;letter-spacing:0}
.auth-field input::placeholder{color:color-mix(in oklab,var(--auth-muted) 72%,transparent)}
.auth-login{margin-top:12px;width:100%;height:42px;border-radius:6px;background:var(--auth-action);color:var(--auth-action-text);font-size:12px;font-weight:700;box-shadow:none}
.auth-login:hover{background:color-mix(in oklab,var(--auth-action) 92%,var(--auth-muted))}
.auth-div{display:flex;align-items:center;gap:12px;margin:12px 0}
.auth-div i{flex:1 1 auto;height:1px;background:var(--auth-border)}
.auth-div b{color:var(--auth-muted);font-size:9px;font-weight:600;letter-spacing:.12em}
.auth-google{width:100%;height:40px;border-radius:6px;border-color:var(--auth-border);background:color-mix(in oklab,var(--auth-surface) 48%,transparent);color:var(--auth-text);font-size:12px;box-shadow:none}
.auth-google:hover{background:var(--auth-surface)}
.auth-bottom{margin:12px 0 0;text-align:center;color:var(--auth-muted);font-size:11px;letter-spacing:0}
.auth-link{height:auto;padding:0;color:var(--auth-text);font-size:11px;font-weight:600;text-decoration:none}
.auth-link:hover{text-decoration:underline;text-underline-offset:3px}
.auth-stage :focus-visible{outline:2px solid var(--auth-focus);outline-offset:2px}
.auth-field input:focus-visible{outline:0}
.auth-photo .auth-badge{color:#fff;border-color:rgba(255,255,255,.22);background:rgba(0,0,0,.38)}
.auth-photo .auth-hl{color:#fff}

.auth-types{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:4px}
.auth-type-btn{display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 6px;
  border:1px solid var(--auth-border);border-radius:6px;background:transparent;color:var(--auth-muted);
  cursor:pointer;font:inherit;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;line-height:1;
  transition:border-color .18s,background .18s,color .18s;}
.auth-type-btn:hover{border-color:color-mix(in oklab,var(--auth-text) 50%,transparent);color:var(--auth-text);}
.auth-type-btn[data-active="true"]{border-color:var(--auth-text);background:var(--auth-surface-strong);color:var(--auth-text);}
.auth-err{margin-top:10px;font-size:12px;color:oklch(.7 .18 27);letter-spacing:0}
.auth-aviso{margin-top:10px;font-size:12px;color:var(--auth-muted);letter-spacing:0}
.auth-forgot{display:block;margin:8px auto 0;text-align:center;background:none;border:none;color:var(--auth-muted);
  font:inherit;font-size:11px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:0;}
.auth-forgot:hover{color:var(--auth-text);}
.auth-resend{display:block;margin-top:6px;text-align:center;background:none;border:none;color:var(--auth-muted);
  font:inherit;font-size:11px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:0;}
.auth-resend:hover{color:var(--auth-text);}
.auth-back{display:flex;align-items:center;gap:6px;background:none;border:none;color:var(--auth-muted);
  font:inherit;font-size:12px;cursor:pointer;padding:0 0 20px;transition:color .18s;}
.auth-back:hover{color:var(--auth-text);}
.auth-visitor{display:block;margin:8px auto 0;text-align:center;background:none;border:none;color:var(--auth-muted);
  font:inherit;font-size:11px;cursor:pointer;padding:0;opacity:.7}
.auth-visitor:hover{opacity:1;text-decoration:underline;text-underline-offset:3px;}

@media (max-width:760px){
  .auth-stage{position:relative;display:flex;flex-direction:column;min-height:100svh;overflow:visible}
  .auth-photo{height:clamp(164px,27svh,218px);flex:0 0 auto}
  .auth-photo-media{object-position:58% 54%}
  .auth-hero{left:20px;right:20px;bottom:18px}
  .auth-badge{height:26px;padding:0 10px;font-size:9px}
  .auth-badge svg{width:11px;height:11px}
  .auth-hl{margin-top:10px;font-size:clamp(25px,7vw,32px);line-height:.94}
  .auth-pane{flex:1;align-items:flex-start;padding:20px 24px max(24px,env(safe-area-inset-bottom));overflow:visible}
  .auth-card{max-width:390px;margin:0 auto}
  .auth-mark{display:none}
  .auth-h1{font-size:21px}
  .auth-sub{margin-top:5px;font-size:11px}
  .auth-tabs{margin-top:16px}
  .auth-fields{margin-top:16px;gap:10px}
  .auth-field-wrap{gap:4px}
  .auth-field{height:40px}
  .auth-login{height:40px;margin-top:14px}
  .auth-div{margin:14px 0}
  .auth-google{height:38px}
  .auth-bottom{margin-top:16px}
}
@media (max-width:370px){
  .auth-photo{height:156px}
  .auth-pane{padding-left:18px;padding-right:18px}
  .auth-hl{font-size:24px}
}
@media (prefers-reduced-motion:reduce){.auth-stage *{transition:none!important;animation:none!important}}
`;

// ── Page component ─────────────────────────────────────────────────────────────

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", senha: "" });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [emailNaoConfirmado, setEmailNaoConfirmado] = useState<string | null>(null);
  const [bloqueadoAte, setBloqueadoAte] = useState<number | null>(null);

  useEffect(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem("login_blocked_until") : null;
    if (v) setBloqueadoAte(Number(v));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("tipo")) return;

    const oauthTs = localStorage.getItem("google_oauth_ts");
    localStorage.removeItem("google_oauth_ts");
    if (!oauthTs) { void navigate({ to: "/" }); return; }

    let cancelled = false;
    const aguardarSessao = async () => {
      for (let i = 0; i < 15; i++) {
        if (cancelled) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const createdAt = new Date(user.created_at).getTime();
          const isNew = createdAt >= Number(oauthTs) - 60_000;
          if (!cancelled) {
            if (isNew) setMode("select-type");
            else void navigate({ to: "/" });
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      if (!cancelled) void navigate({ to: "/" });
    };

    void aguardarSessao();
    return () => { cancelled = true; };
  }, [navigate]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const mascararEmail = (email: string) => {
    const [nome = "", dominio = ""] = email.split("@");
    const visivel = nome.slice(0, 2);
    return `${visivel}${"*".repeat(Math.max(nome.length - visivel.length, 3))}@${dominio}`;
  };

  const traduzErro = (message: string) => {
    if (/already registered|already been registered/i.test(message)) return "Este e-mail já possui uma conta. Tente entrar.";
    if (/Invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
    if (/pwned|compromised/i.test(message)) return "Escolha uma senha mais segura.";
    if (/at least/i.test(message)) return "A senha precisa ter pelo menos 8 caracteres.";
    if (/not confirmed|confirmation/i.test(message)) return "Conta criada. Confirme o e-mail que enviamos para entrar.";
    return "Não foi possível concluir. Tente novamente.";
  };

  const validarSenha = (senha: string): string | null => {
    if (!/[A-Z]/.test(senha)) return "A senha precisa ter pelo menos uma letra maiúscula.";
    if (!/[^A-Za-z0-9]/.test(senha)) return "A senha precisa ter pelo menos um caractere especial.";
    return null;
  };

  // ── Auth handlers ─────────────────────────────────────────────────────────────

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(form.email)) { setErro("Digite um e-mail válido."); return; }
    const agora = Date.now();
    if (bloqueadoAte && agora < bloqueadoAte) {
      const restam = Math.ceil((bloqueadoAte - agora) / 60000);
      setErro(`Muitas tentativas. Aguarde ${restam} min.`);
      return;
    }
    const rl = await checkRateLimit("login");
    if (rl.blocked) {
      const min = rl.retryAfterSeconds ? Math.ceil(rl.retryAfterSeconds / 60) : 5;
      setErro(`Muitas tentativas incorretas. Aguarde ${min} min.`);
      return;
    }
    setBusy(true); setErro(null); setEmailNaoConfirmado(null);
    try {
      await signIn(form.email, form.senha);
      localStorage.removeItem("login_attempts");
      localStorage.removeItem("login_blocked_until");
      void navigate({ to: "/" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (/not confirmed|email not confirmed/i.test(msg)) {
        setEmailNaoConfirmado(form.email.trim());
        setErro("Confirme seu e-mail antes de entrar.");
      } else if (/Invalid login credentials/i.test(msg)) {
        void recordRateLimitAttempt("login");
        const tentativas = Number(localStorage.getItem("login_attempts") ?? "0") + 1;
        localStorage.setItem("login_attempts", String(tentativas));
        if (tentativas >= 5) {
          const ate = Date.now() + 5 * 60 * 1000;
          localStorage.setItem("login_blocked_until", String(ate));
          setBloqueadoAte(ate);
          setErro("Muitas tentativas incorretas. Aguarde 5 min.");
        } else {
          setErro(`E-mail ou senha incorretos. ${5 - tentativas} tentativa${5 - tentativas > 1 ? "s" : ""} restante${5 - tentativas > 1 ? "s" : ""}.`);
        }
      } else {
        setErro(traduzErro(msg));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountType) { setErro("Selecione o tipo de conta."); return; }
    if (!isValidEmail(form.email)) { setErro("Digite um e-mail válido."); return; }
    const erroSenha = validarSenha(form.senha);
    if (erroSenha) { setErro(erroSenha); return; }
    const rl = await checkRateLimit("signup");
    if (rl.blocked) {
      const min = rl.retryAfterSeconds ? Math.ceil(rl.retryAfterSeconds / 60) : 60;
      setErro(`Muitas tentativas. Aguarde ${min} min.`);
      return;
    }
    setBusy(true); setErro(null); setAviso(null);
    await recordRateLimitAttempt("signup");
    try {
      await signUpWithType({ nome: form.nome, email: form.email, senha: form.senha, tipo: accountType.id as ClientType });
      const email = form.email.trim();
      setAviso(`Confirme o e-mail enviado para ${mascararEmail(email)}.`);
      setForm({ nome: "", email, senha: "" });
      setAccountType(null);
      setMode("login");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (/already registered/i.test(msg)) {
        setAviso("Este e-mail já possui uma conta.");
        setMode("login");
      } else {
        setErro(traduzErro(msg));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim()) return;
    setBusy(true); setErro(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
        redirectTo: "https://solatto.com.br/redefinir-senha",
      });
      if (error) throw error;
      setMode("reset-sent");
    } catch {
      setErro("Não foi possível enviar o e-mail. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const reenviarConfirmacao = async () => {
    if (!emailNaoConfirmado) return;
    setBusy(true); setErro(null);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: emailNaoConfirmado });
      if (error) throw error;
      setAviso(`E-mail reenviado para ${mascararEmail(emailNaoConfirmado)}.`);
      setEmailNaoConfirmado(null);
    } catch {
      setErro("Não foi possível reenviar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    try {
      localStorage.setItem("google_oauth_ts", String(Date.now()));
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/entrar?tipo=1` },
      });
    } catch {
      setErro("Não foi possível entrar com Google. Tente novamente.");
    }
  };

  const handleSelectType = async (tipo: ClientType) => {
    setBusy(true); setErro(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("não autenticado");

      if (tipo !== "varejo") {
        await supabase.from("client_type_requests").insert({
          user_id: user.id,
          tipo_solicitado: tipo,
          status: "pendente",
        });
      } else {
        await supabase.from("user_client_types")
          .upsert({ user_id: user.id, tipo: "varejo" }, { onConflict: "user_id" });
      }

      void navigate({ to: "/" });
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setErro(null);
    setAviso(null);
    setEmailNaoConfirmado(null);
  };

  const isLogin = mode === "login";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="auth-stage">

        {/* ── Photo panel ── */}
        <section className="auth-photo">
          <video
            className="auth-photo-media"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="Homem calçando um sapato de couro"
          >
            <source src={heroVideo.url} type="video/mp4" />
          </video>
          <div className="auth-scrim" />
          <div className="auth-hero">
            <h2 className="auth-hl">
              <span>O passo certo</span>
              <span>começa aqui</span>
            </h2>
          </div>
        </section>

        {/* ── Card panel ── */}
        <section className="auth-pane">
          <div className="auth-card">

            {/* reset-sent */}
            {mode === "reset-sent" && (
              <>
                <div className="auth-mark" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#000000"/><text x="16" y="23" fontFamily="serif" fontSize="22" fontWeight="700" fill="#ffffff" textAnchor="middle">S</text></svg></div>
                <h1 className="auth-h1">E-mail enviado!</h1>
                <p className="auth-sub">Verifique sua caixa de entrada para redefinir a senha.</p>
                <Button
                  type="button"
                  className="auth-login"
                  style={{ marginTop: 28 }}
                  onClick={() => { setMode("login"); setErro(null); }}
                >
                  Voltar ao login
                </Button>
              </>
            )}

            {/* forgot password */}
            {mode === "forgot" && (
              <>
                <button type="button" className="auth-back" onClick={() => { setMode("login"); setErro(null); }}>
                  <svg width="14" height="14" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                    <path d="M19 11H3.6M11 18.7 3.3 11 11 3.3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Voltar
                </button>
                <div className="auth-mark" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#000000"/><text x="16" y="23" fontFamily="serif" fontSize="22" fontWeight="700" fill="#ffffff" textAnchor="middle">S</text></svg></div>
                <h1 className="auth-h1">Esqueci minha senha</h1>
                <p className="auth-sub">Enviaremos um link para criar uma nova senha.</p>
                <div className="auth-fields">
                  <div className="auth-field-wrap">
                    <label className="auth-label" htmlFor="auth-forgot-email">E-mail</label>
                    <div className="auth-field">
                      <input
                        id="auth-forgot-email"
                        type="email"
                        autoComplete="email"
                        placeholder="nome@email.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        maxLength={255}
                      />
                    </div>
                  </div>
                </div>
                {erro && <p className="auth-err">{erro}</p>}
                <Button
                  type="button"
                  className="auth-login"
                  disabled={busy || !form.email.trim()}
                  onClick={handleForgotPassword}
                >
                  {busy ? "Enviando…" : "Enviar link"}
                </Button>
              </>
            )}

            {/* login / signup */}
            {(mode === "login" || mode === "signup") && (
              <>
                <div className="auth-mark" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#000000"/><text x="16" y="23" fontFamily="serif" fontSize="22" fontWeight="700" fill="#ffffff" textAnchor="middle">S</text></svg></div>
                <h1 className="auth-h1">{isLogin ? "Bem-vindo de volta!" : "Crie sua conta"}</h1>
                <p className="auth-sub">
                  {isLogin
                    ? "Entre para acompanhar seus pedidos e favoritos."
                    : "Cadastre-se e receba ofertas antes de todo mundo."}
                </p>

                <div className="auth-tabs" role="tablist" aria-label="Entrar ou cadastrar">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isLogin}
                    data-active={String(isLogin)}
                    onClick={() => switchMode("login")}
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={!isLogin}
                    data-active={String(!isLogin)}
                    onClick={() => switchMode("signup")}
                  >
                    Cadastrar
                  </button>
                </div>

                <div className="auth-fields">
                  {!isLogin && (
                    <>
                      <div className="auth-types">
                        {accountTypes.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className="auth-type-btn"
                            data-active={String(accountType?.id === t.id)}
                            onClick={() => setAccountType(t)}
                          >
                            <t.Icon size={16} />
                            {t.name}
                          </button>
                        ))}
                      </div>
                      <div className="auth-field-wrap">
                        <label className="auth-label" htmlFor="auth-nome">Nome completo</label>
                        <div className="auth-field">
                          <input
                            id="auth-nome"
                            type="text"
                            autoComplete="name"
                            placeholder="Seu nome completo"
                            value={form.nome}
                            onChange={(e) => setForm({ ...form, nome: e.target.value })}
                            maxLength={120}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="auth-field-wrap">
                    <label className="auth-label" htmlFor="auth-email">E-mail</label>
                    <div className="auth-field">
                      <input
                        id="auth-email"
                        type="email"
                        autoComplete="email"
                        placeholder="nome@email.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        maxLength={255}
                      />
                    </div>
                  </div>

                  <div className="auth-field-wrap">
                    <label className="auth-label" htmlFor="auth-senha">Senha</label>
                    <div className="auth-field">
                      <input
                        id="auth-senha"
                        type="password"
                        autoComplete={isLogin ? "current-password" : "new-password"}
                        placeholder="••••••••"
                        value={form.senha}
                        onChange={(e) => setForm({ ...form, senha: e.target.value })}
                        minLength={8}
                        maxLength={72}
                      />
                    </div>
                  </div>
                </div>

                {erro && <p className="auth-err">{erro}</p>}
                {aviso && <p className="auth-aviso">{aviso}</p>}

                {emailNaoConfirmado && (
                  <button type="button" className="auth-resend" disabled={busy} onClick={reenviarConfirmacao}>
                    Reenviar e-mail de confirmação
                  </button>
                )}

                <Button
                  type="button"
                  className="auth-login"
                  disabled={busy}
                  onClick={isLogin ? handleSignIn : handleSignUp}
                >
                  <span>{isLogin ? (busy ? "Entrando…" : "Entrar") : (busy ? "Criando…" : "Criar conta")}</span>
                  <svg viewBox="0 0 22 22" fill="none" aria-hidden="true" style={{ width: 16, height: 16 }}>
                    <path d="M4 11h13M12 5.5 17.5 11 12 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>

                {isLogin && (
                  <button type="button" className="auth-forgot" onClick={() => { setMode("forgot"); setErro(null); }}>
                    Esqueceu a senha?
                  </button>
                )}

                <div className="auth-div"><i /><b>OU</b><i /></div>

                <Button type="button" variant="outline" className="auth-google" onClick={googleSignIn}>
                  <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.4 5.8 2.5 13.6l7.8 6C12.2 13.6 17.6 9.5 24 9.5Z" />
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.6c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7.1-10.2 7.1-17.4Z" />
                    <path fill="#FBBC05" d="M10.3 28.4a14.6 14.6 0 0 1 0-8.8l-7.8-6a23.5 23.5 0 0 0 0 20.8l7.8-6Z" />
                    <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.4-5.6l-7.6-5.9c-2.1 1.4-4.8 2.3-7.8 2.3-6.4 0-11.8-4.1-13.7-9.9l-7.8 6C6.4 42.2 14.6 47.5 24 47.5Z" />
                  </svg>
                  <span>{isLogin ? "Entrar com Google" : "Cadastrar com Google"}</span>
                </Button>

                <p className="auth-bottom">
                  {isLogin ? "Não tem uma conta? " : "Já tem uma conta? "}
                  <Button
                    type="button"
                    variant="link"
                    className="auth-link"
                    onClick={() => switchMode(isLogin ? "signup" : "login")}
                  >
                    {isLogin ? "Criar agora" : "Entrar"}
                  </Button>
                </p>

                <button type="button" className="auth-visitor" onClick={() => void navigate({ to: "/" })}>
                  Continuar como visitante
                </button>
              </>
            )}

            {mode === "select-type" && (
              <>
                <div className="auth-mark" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#000000"/><text x="16" y="23" fontFamily="serif" fontSize="22" fontWeight="700" fill="#ffffff" textAnchor="middle">S</text></svg></div>
                <h1 className="auth-h1">Como você vai comprar?</h1>
                <p className="auth-sub">Escolha o tipo de conta para continuar. Atacado e Drops precisam de aprovação.</p>

                <div className="auth-types" style={{ marginTop: 8 }}>
                  {accountTypes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="auth-type-btn"
                      data-active={String(accountType?.id === t.id)}
                      onClick={() => setAccountType(t)}
                    >
                      <t.Icon size={16} />
                      {t.name}
                    </button>
                  ))}
                </div>

                {erro && <p className="auth-err">{erro}</p>}

                <Button
                  type="button"
                  className="auth-login"
                  disabled={busy || !accountType}
                  onClick={() => accountType && void handleSelectType(accountType.id as ClientType)}
                >
                  <span>{busy ? "Salvando…" : "Confirmar"}</span>
                  <svg viewBox="0 0 22 22" fill="none" aria-hidden="true" style={{ width: 16, height: 16 }}>
                    <path d="M4 11h13M12 5.5 17.5 11 12 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>

                <button type="button" className="auth-visitor" onClick={() => void navigate({ to: "/" })}>
                  Pular, entrar como Varejo
                </button>
              </>
            )}

          </div>
        </section>
      </div>
    </>
  );
}
