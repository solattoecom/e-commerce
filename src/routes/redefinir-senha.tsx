import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/external";

export const Route = createFileRoute("/redefinir-senha")({
  component: RedefinirSenhaPage,
  head: () => ({
    meta: [{ title: "Redefinir senha | Solatto" }],
  }),
});

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [sessaoValida, setSessaoValida] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessaoValida(!!data.session);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (!/[A-Z]/.test(senha)) {
      setErro("A senha precisa ter pelo menos uma letra maiúscula.");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(senha)) {
      setErro("A senha precisa ter pelo menos um caractere especial.");
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      setSucesso(true);
      setTimeout(() => navigate({ to: "/" }), 3000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between">
          <Link to="/" className="text-lg font-bold uppercase tracking-[0.18em] sm:text-xl sm:tracking-[0.22em]">
            Solatto
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-sm flex-col items-center justify-center px-4 py-24">
        {sessaoValida === null ? null : !sessaoValida ? (
          <>
            <h1 className="mb-3 text-2xl font-semibold">Link inválido ou expirado</h1>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Este link de redefinição de senha é inválido ou já expirou. Solicite um novo link.
            </p>
            <Button asChild className="h-12 w-full">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </>
        ) : sucesso ? (
          <>
            <h1 className="mb-3 text-2xl font-semibold">Senha redefinida!</h1>
            <p className="text-center text-sm text-muted-foreground">
              Sua senha foi alterada com sucesso. Você será redirecionado em instantes…
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-2xl font-semibold">Criar nova senha</h1>
            <p className="mb-7 text-center text-sm text-muted-foreground">
              Escolha uma senha com pelo menos 8 caracteres, uma letra maiúscula e um caractere especial.
            </p>
            <form className="grid w-full gap-3" onSubmit={handleSubmit}>
              <Input
                required
                type="password"
                placeholder="Nova senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                minLength={8}
                maxLength={72}
                className="h-12"
              />
              <Input
                required
                type="password"
                placeholder="Confirmar nova senha"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                minLength={8}
                maxLength={72}
                className="h-12"
              />
              {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
              <Button type="submit" disabled={busy} className="h-12">
                {busy ? "Salvando…" : "Salvar nova senha"}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
