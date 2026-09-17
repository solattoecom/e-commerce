import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, UserCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/external";
import { useAuth } from "@/hooks/useAuth";
import { deleteMyAccount } from "@/lib/account.functions";
import { isValidEmail } from "@/lib/validate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dados, setDados] = useState<{ nome: string; email: string; tipo: string | null } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [{ data: perfil }, { data: tipo }] = await Promise.all([
        supabase.from("profiles").select("nome").eq("id", user.id).maybeSingle(),
        supabase.from("user_client_types").select("tipo").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      setDados({
        nome: perfil?.nome ?? "",
        email: user.email ?? "",
        tipo: tipo?.tipo ?? null,
      });
    })();
    return () => { active = false; };
  }, [user]);

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dados || !user) return;
    if (dados.email.trim() && !isValidEmail(dados.email)) { setErro("Digite um e-mail válido."); return; }
    setSalvando(true);
    setErro(null);
    setMsg(null);
    try {
      const { error: perfilErro } = await supabase
        .from("profiles")
        .update({ nome: dados.nome.trim() })
        .eq("id", user.id);
      if (perfilErro) throw new Error(perfilErro.message);

      if (dados.email.trim() && dados.email.trim() !== user.email) {
        const { error: emailErro } = await supabase.auth.updateUser({ email: dados.email.trim() });
        if (emailErro) throw new Error(emailErro.message);
        setMsg("Dados salvos. Confirme o novo e-mail pelo link enviado.");
      } else {
        setMsg("Dados salvos.");
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    setExcluindo(true);
    setErro(null);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      void navigate({ to: "/" });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível excluir a conta.");
      setExcluindo(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold">
        <UserCircle className="h-6 w-6" /> Meu Perfil
      </h1>

      <div className="rounded-2xl border border-border bg-background p-6">
        <form onSubmit={salvar} className="space-y-4 text-sm">
          <label className="block space-y-1.5">
            <span className="text-muted-foreground">Nome completo</span>
            <Input
              value={dados?.nome ?? ""}
              onChange={(e) => setDados((d) => d ? { ...d, nome: e.target.value } : d)}
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-muted-foreground">E-mail</span>
            <Input
              type="email"
              value={dados?.email ?? ""}
              onChange={(e) => setDados((d) => d ? { ...d, email: e.target.value } : d)}
              required
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-muted-foreground">Tipo de conta</span>
            <p className="rounded-md border border-border bg-muted/50 px-3 py-2 capitalize text-muted-foreground">
              {dados?.tipo ?? "—"}
            </p>
          </div>

          {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
          {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

          <Button type="submit" disabled={salvando || !dados} className="w-full bg-foreground text-background hover:bg-foreground/85">
            {salvando ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>

        <div className="mt-6 border-t border-border pt-5">
          {confirmar ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Excluir a conta apaga seus dados definitivamente.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={excluir}
                  disabled={excluindo}
                  className="flex-1 cursor-pointer rounded-md border border-black bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white disabled:opacity-70"
                >
                  {excluindo ? "Excluindo…" : "Confirmar exclusão"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmar(false)}
                  className="flex-1 cursor-pointer rounded-md bg-muted px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted/70"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              className="w-full cursor-pointer rounded-md border border-black bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white"
            >
              Excluir conta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
