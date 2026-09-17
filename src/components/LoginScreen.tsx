import { useEffect, useRef, useState } from "react";
import { Building2, Store, Truck } from "lucide-react";
import { signIn, signUpWithType, type ClientType } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/external";
import { isValidEmail } from "@/lib/validate";
import { checkRateLimit, recordRateLimitAttempt } from "@/lib/rate-limit.functions";

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

const accountTypes = [
  { id: "varejo", name: "Varejo", description: "Compre para você, com entrega em todo o Brasil.", Icon: Store },
  { id: "atacado", name: "Atacado", description: "Compras em volume com condições especiais.", Icon: Building2 },
  { id: "dropshipping", name: "Dropshipping", description: "Venda sem estoque, nós enviamos por você.", Icon: Truck },
] as const;

type AccountType = (typeof accountTypes)[number];

// ── SVG helpers ────────────────────────────────────────────────────────────────

function BoltIcon() {
  return (
    <svg width="17" height="16.27" viewBox="0 0 582 557" fill="none">
      <path
        fillRule="evenodd"
        fill="#fff"
        d="M449 0 435 0 415 10 200 249 187 276 189 299 212 326 232 332 289 334 289 516 301 543 324 556 346 556 374 536 573 311 582 288 579 264 559 240 539 233 478 230 478 32 470 13Z M442 38 446 250 466 267 540 270 547 285 341 520 332 522 324 514 321 314 307 300 295 297 233 297 224 291 221 282Z M1 67 4 81 17 90 216 90 223 87 232 74 228 57 215 49 18 49 5 57Z M0 285 4 300 17 308 105 308 118 299 121 291 119 278 111 270 103 267 17 267 4 275Z M1 495 4 511 10 517 23 520 179 520 191 516 200 500 196 488 182 479 18 479 9 483Z"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path
        d="M3 11h15.4M11 3.3l7.7 7.7-7.7 7.7"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
      <path
        d="M19 11H3.6M11 18.7 3.3 11 11 3.3"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="ls-g-icon" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function LoginScreen({ onClose, onSuccess }: Props) {
  // Layout refs
  const photoRef = useRef<HTMLElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardInRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const hl1Ref = useRef<HTMLSpanElement>(null);
  const hl2Ref = useRef<HTMLSpanElement>(null);

  // Auth states
  const [showLogin, setShowLogin] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [form, setForm] = useState({ nome: "", sobrenome: "", email: "", senha: "" });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [emailNaoConfirmado, setEmailNaoConfirmado] = useState<string | null>(null);
  const [bloqueadoAte, setBloqueadoAte] = useState<number | null>(null);

  useEffect(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem("login_blocked_until") : null;
    if (v) setBloqueadoAte(Number(v));
  }, []);

  // ── Auth helpers ─────────────────────────────────────────────────────────────

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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(form.email)) { setErro("Digite um e-mail válido."); return; }
    const agora = Date.now();
    if (bloqueadoAte && agora < bloqueadoAte) {
      const restam = Math.ceil((bloqueadoAte - agora) / 60000);
      setErro(`Muitas tentativas. Aguarde ${restam} min para tentar novamente.`);
      return;
    }
    const rlLogin = await checkRateLimit("login");
    if (rlLogin.blocked) {
      const min = rlLogin.retryAfterSeconds ? Math.ceil(rlLogin.retryAfterSeconds / 60) : 5;
      setErro(`Muitas tentativas incorretas. Aguarde ${min} min para tentar novamente.`);
      return;
    }
    setBusy(true);
    setErro(null);
    setEmailNaoConfirmado(null);
    try {
      await signIn(form.email, form.senha);
      localStorage.removeItem("login_attempts");
      localStorage.removeItem("login_blocked_until");
      setBloqueadoAte(null);
      setForm({ nome: "", sobrenome: "", email: "", senha: "" });
      onSuccess();
      onClose();
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
          setErro("Muitas tentativas incorretas. Aguarde 5 min para tentar novamente.");
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
    if (!accountType) return;
    if (!isValidEmail(form.email)) { setErro("Digite um e-mail válido."); return; }
    const erroSenha = validarSenha(form.senha);
    if (erroSenha) { setErro(erroSenha); return; }
    setBusy(true);
    setErro(null);
    setAviso(null);
    const rlSignup = await checkRateLimit("signup");
    if (rlSignup.blocked) {
      const min = rlSignup.retryAfterSeconds ? Math.ceil(rlSignup.retryAfterSeconds / 60) : 60;
      setErro(`Muitas tentativas de cadastro. Aguarde ${min} min para tentar novamente.`);
      setBusy(false);
      return;
    }
    await recordRateLimitAttempt("signup");
    try {
      await signUpWithType({ ...form, tipo: accountType.id as ClientType });
      const email = form.email.trim();
      setAviso(`Confirme o e-mail enviado para ${mascararEmail(email)}.`);
      setForm({ nome: "", sobrenome: "", email, senha: "" });
      setAccountType(null);
      setShowLogin(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (/already registered/i.test(msg)) {
        setAviso("Este e-mail já possui uma conta.");
        setAccountType(null);
        setShowLogin(true);
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
    setBusy(true);
    setErro(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
        redirectTo: "https://solatto.com.br/redefinir-senha",
      });
      if (error) throw error;
      setResetEmailSent(true);
    } catch {
      setErro("Não foi possível enviar o e-mail. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const reenviarConfirmacao = async () => {
    if (!emailNaoConfirmado) return;
    setBusy(true);
    setErro(null);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: emailNaoConfirmado });
      if (error) throw error;
      setAviso(`E-mail de confirmação reenviado para ${mascararEmail(emailNaoConfirmado)}.`);
      setEmailNaoConfirmado(null);
    } catch {
      setErro("Não foi possível reenviar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    } catch {
      setErro("Não foi possível entrar com Google. Tente novamente.");
    }
  };

  // ── Layout engine ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const REF_W = 1464, PANE_W = 628, CARD_W = 613, CONTENT_H = 697;
    const IMG_W = 1177, IMG_H = 1336, IMG_REF_SCALE = 836 / 1177;
    const PANE_RATIO = PANE_W / REF_W;
    const HERO_W = 681;
    const RAMP_HI = 1280, RAMP_LO = 1000, PHOTO_MIN = 0.42, RAMP_LO2 = 820, PHOTO_MIN2 = 0.36;

    const mqLand = window.matchMedia("(min-width:700px) and (min-aspect-ratio:51/50)");

    function photoRatio(vw: number) {
      if (vw >= RAMP_HI) return 1 - PANE_RATIO;
      if (vw >= RAMP_LO) {
        const t = (vw - RAMP_LO) / (RAMP_HI - RAMP_LO);
        return PHOTO_MIN + t * ((1 - PANE_RATIO) - PHOTO_MIN);
      }
      if (vw >= RAMP_LO2) {
        const t = (vw - RAMP_LO2) / (RAMP_LO - RAMP_LO2);
        return PHOTO_MIN2 + t * (PHOTO_MIN - PHOTO_MIN2);
      }
      return PHOTO_MIN2;
    }

    function layout() {
      const photo = photoRef.current, pane = paneRef.current;
      const card = cardRef.current, cardIn = cardInRef.current, hero = heroRef.current;
      if (!photo || !pane || !card || !cardIn || !hero) return;
      const vw = window.innerWidth, vh = window.innerHeight;

      if (!mqLand.matches) {
        [photo, pane, card, cardIn, hero].forEach((el) => (el.style.cssText = ""));
        return;
      }

      // Desktop landscape
      const pr = photoRatio(vw);
      const photoW = Math.round(vw * pr);
      const paneW = vw - photoW;
      photo.style.width = photoW + "px";
      pane.style.left = photoW + "px";
      pane.style.right = "0";
      pane.style.top = "0";
      pane.style.bottom = "0";
      pane.style.display = "flex";
      pane.style.alignItems = "center";
      pane.style.justifyContent = "center";
      pane.style.padding = "14px 14px 13px 1px";

      // Card sizing
      const cs = Math.min(paneW / PANE_W, vh / CONTENT_H);
      const gapL = 1 * cs, mT = 14 * cs, mB = 13 * cs, mR = 14 * cs;
      const cw = Math.max(CARD_W * cs, paneW - gapL - mR);
      const ch = vh - mT - mB;
      card.style.cssText = `width:${cw}px;height:${ch}px;border-radius:${26 * cs}px;max-width:none;flex:none;`;

      // Hero scaling
      const imgScale = Math.max(photoW / IMG_W, vh / IMG_H);
      const s = Math.min(imgScale / IMG_REF_SCALE, (photoW * 0.92) / HERO_W);
      hero.style.transform = `scale(${s})`;

      document.documentElement.style.removeProperty("--ls-band-h");
    }

    const onResize = () => layout();
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize);
    mqLand.addEventListener("change", onResize);
    document.fonts.ready.then(layout);
    layout();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      mqLand.removeEventListener("change", onResize);
    };
  }, []);

  // ── Entrance animation ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    if (!Element.prototype.animate) return;

    const ease = "cubic-bezier(.16,1,.3,1)";
    const soft = "cubic-bezier(.22,1,.36,1)";
    const compact = window.innerWidth < 700;
    const animations: Animation[] = [];

    const anim = (
      el: Element | null,
      from: Keyframe,
      to: Keyframe,
      delay: number,
      dur: number,
      easing: string,
    ) => {
      if (!el) return;
      const a = el.animate([from, to], { delay, duration: dur, easing, fill: "both" });
      animations.push(a);
    };

    const to = { opacity: 1, transform: "none" };
    const toClip = { opacity: 1, transform: "none", clipPath: "inset(0 0 0 0)" };
    const dy = compact ? 12 : 16;

    anim(
      cardRef.current,
      { opacity: 0, transform: compact ? "translateY(14px)" : "translateY(12px) scale(.988)" },
      to,
      40,
      820,
      ease,
    );
    anim(badgeRef.current, { opacity: 0, transform: "translateY(8px)" }, to, 120, 480, soft);
    anim(
      hl1Ref.current,
      { opacity: 0, transform: `translateY(${dy}px)`, clipPath: "inset(100% 0 0 0)" },
      toClip,
      240,
      760,
      ease,
    );
    anim(
      hl2Ref.current,
      { opacity: 0, transform: `translateY(${dy}px)`, clipPath: "inset(100% 0 0 0)" },
      toClip,
      330,
      760,
      ease,
    );

    Promise.allSettled(animations.map((a) => a.finished)).then(() => {
      animations.forEach((a) => {
        try { a.cancel(); } catch { /* noop */ }
      });
    });

    return () => animations.forEach((a) => {
      try { a.cancel(); } catch { /* noop */ }
    });
  }, []);

  // ── Card content ──────────────────────────────────────────────────────────────

  function CardContent() {
    // reset-sent state
    if (resetEmailSent) {
      return (
        <div className="ls-card-body">
          <h1 className="ls-h1">E-mail<br />enviado!</h1>
          <p className="ls-sub">Verifique sua caixa de entrada para redefinir a senha.</p>
          <button
            type="button"
            className="ls-login-btn"
            onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }}
          >
            Voltar ao login <ArrowIcon />
          </button>
        </div>
      );
    }

    // forgot-password state
    if (showForgotPassword) {
      return (
        <div className="ls-card-body">
          <button
            type="button"
            className="ls-back"
            onClick={() => { setShowForgotPassword(false); setErro(null); }}
          >
            <ArrowLeftIcon /> Voltar
          </button>
          <h1 className="ls-h1">Esqueci minha<br />senha</h1>
          <p className="ls-sub">Enviaremos um link para criar uma nova senha.</p>
          <div className="ls-field ls-email">
            <input
              type="email"
              placeholder="Seu e-mail"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={255}
              autoComplete="email"
            />
          </div>
          {erro && <p className="ls-error">{erro}</p>}
          <button
            type="button"
            className="ls-login-btn"
            disabled={busy}
            onClick={handleForgotPassword}
          >
            {busy ? "Enviando…" : "Enviar link"} <ArrowIcon />
          </button>
        </div>
      );
    }

    // login state
    if (showLogin) {
      return (
        <div className="ls-card-body">
          <button
            type="button"
            className="ls-back"
            onClick={() => { setShowLogin(false); setErro(null); setAviso(null); }}
          >
            <ArrowLeftIcon /> Voltar
          </button>
          <h1 className="ls-h1">Bem-vindo<br />de volta!</h1>
          <p className="ls-sub"><b>Entre</b> para continuar sua jornada.</p>
          {aviso && <p className="ls-aviso">{aviso}</p>}
          <div className="ls-field ls-email">
            <input
              type="email"
              placeholder="E-mail"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={255}
              autoComplete="email"
            />
          </div>
          <div className="ls-field ls-pw">
            <input
              type="password"
              placeholder="Senha"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              minLength={8}
              maxLength={72}
              autoComplete="current-password"
            />
          </div>
          {erro && <p className="ls-error">{erro}</p>}
          {emailNaoConfirmado && (
            <button
              type="button"
              className="ls-forgot"
              disabled={busy}
              onClick={reenviarConfirmacao}
            >
              Reenviar e-mail de confirmação
            </button>
          )}
          <button
            type="button"
            className="ls-login-btn"
            disabled={busy}
            onClick={handleSignIn}
          >
            {busy ? "Entrando…" : "Entrar"} <ArrowIcon />
          </button>
          <div className="ls-divider"><i /><b>OU</b><i /></div>
          <button type="button" className="ls-g-btn" onClick={googleSignIn}>
            <GoogleIcon /> Entrar com Google
          </button>
          <p className="ls-bottom">
            Não tem conta?{" "}
            <a onClick={() => { setShowLogin(false); setErro(null); setAviso(null); }}>
              Criar conta
            </a>
          </p>
          <button
            type="button"
            className="ls-forgot"
            onClick={() => { setShowForgotPassword(true); setErro(null); }}
          >
            Esqueci minha senha
          </button>
        </div>
      );
    }

    // signup state
    if (accountType) {
      return (
        <div className="ls-card-body">
          <button
            type="button"
            className="ls-back"
            onClick={() => { setAccountType(null); setErro(null); }}
          >
            <ArrowLeftIcon /> Voltar
          </button>
          <h1 className="ls-h1">Criar conta<br />{accountType.name}</h1>
          <p className="ls-sub">{accountType.description}</p>
          <div className="ls-name-row">
            <div className="ls-field">
              <input
                type="text"
                placeholder="Nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                maxLength={60}
                autoComplete="given-name"
              />
            </div>
            <div className="ls-field">
              <input
                type="text"
                placeholder="Sobrenome"
                value={form.sobrenome}
                onChange={(e) => setForm({ ...form, sobrenome: e.target.value })}
                maxLength={60}
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="ls-field ls-email">
            <input
              type="email"
              placeholder="E-mail"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={255}
              autoComplete="email"
            />
          </div>
          <div className="ls-field ls-pw">
            <input
              type="password"
              placeholder="Senha"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
            />
          </div>
          {erro && <p className="ls-error">{erro}</p>}
          <button
            type="button"
            className="ls-login-btn"
            disabled={busy}
            onClick={handleSignUp}
          >
            {busy ? "Criando…" : "Criar conta"} <ArrowIcon />
          </button>
        </div>
      );
    }

    // choose-type state (default)
    return (
      <div className="ls-card-body">
        <h1 className="ls-h1">Como quer<br />comprar?</h1>
        <p className="ls-sub">Escolha seu tipo de acesso para continuar.</p>
        {accountTypes.map((type) => {
          const { id, name, description, Icon } = type;
          return (
            <button
              key={id}
              type="button"
              className="ls-type-btn"
              onClick={() => { setAccountType(type); setErro(null); }}
            >
              <Icon size={20} />
              <span>
                <span className="ls-type-name">{name}</span>
                <span className="ls-type-desc">{description}</span>
              </span>
            </button>
          );
        })}
        <div className="ls-divider"><i /><b>OU</b><i /></div>
        <button type="button" className="ls-g-btn" onClick={googleSignIn}>
          <GoogleIcon /> Entrar com Google
        </button>
        <p className="ls-bottom">
          Já tem conta?{" "}
          <a onClick={() => { setShowLogin(true); setErro(null); setAviso(null); }}>
            Entrar
          </a>
        </p>
        <button type="button" className="ls-visitor" onClick={onClose}>
          Continuar como visitante
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="ls-stage">
      <section className="ls-photo" ref={photoRef}>
        <video
          className="ls-video ls-video--tall"
          autoPlay
          muted
          loop
          playsInline
          src="/assets/hero-calcando-sapato.mp4"
        />
        <video
          className="ls-video ls-video--wide"
          aria-hidden
          autoPlay
          muted
          loop
          playsInline
          src="/assets/hero-calcando-sapato.mp4"
        />
        <div className="ls-scrim" />
        <div className="ls-hero" ref={heroRef}>
          <div className="ls-badge" ref={badgeRef}>
            <span className="ls-badge-icon">
              <BoltIcon />
            </span>
            <span>Artesanal · Feito para durar</span>
          </div>
          <div className="ls-hl-wrap">
            <span className="ls-hl ls-hl1" id="hl1" ref={hl1Ref}>Calçados que vão</span>
            <span className="ls-hl ls-hl2" id="hl2" ref={hl2Ref}>com você</span>
          </div>
        </div>
      </section>

      <section className="ls-pane" ref={paneRef}>
        <div className="ls-card" ref={cardRef}>
          <div className="ls-card-in" ref={cardInRef}>
            <CardContent />
          </div>
        </div>
      </section>
    </div>
  );
}
