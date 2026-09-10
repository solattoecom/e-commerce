import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { AdminProdutos } from "@/components/AdminProdutos";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAdminExists } from "@/hooks/useAdminExists";
import { claimFirstAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPanel,
  head: () => ({
    meta: [
      { title: "Painel administrativo | Solatto" },
      {
        name: "description",
        content:
          "Aprove contas de atacado e dropshipping e acompanhe os pedidos da loja Solatto.",
      },
      { property: "og:title", content: "Painel administrativo | Solatto" },
      {
        property: "og:description",
        content: "Aprovações de contas e gestão de pedidos da loja Solatto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <Aviso titulo="Algo deu errado" texto="Não foi possível carregar o painel." />
  ),
  notFoundComponent: () => <Aviso titulo="Página não encontrada" texto="" />,
});

type Solicitacao = {
  id: string;
  user_id: string;
  tipo_solicitado: string;
  status: string;
  criado_em: string;
  profiles: { nome: string; sobrenome: string; email: string } | null;
};

type Pedido = {
  id: string;
  status: string;
  total: number;
  criado_em: string;
  usuario_id: string;
  profiles: { nome: string; sobrenome: string; email: string } | null;
  order_items: { id: string; quantidade: number }[];
};

const STATUS_PEDIDO = [
  "pendente",
  "pago",
  "separando",
  "enviado",
  "entregue",
  "cancelado",
] as const;

const brl = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      {texto ? <p className="text-muted-foreground">{texto}</p> : null}
      <Link to="/" className="text-sm underline underline-offset-4">
        Voltar para a loja
      </Link>
    </main>
  );
}

function AdminPanel() {
  const { user, loading: carregandoUsuario } = useAuth();
  const { isAdmin, loading: carregandoPapel } = useIsAdmin(user?.id);
  const { existe: jaTemAdmin } = useAdminExists();
  const [aba, setAba] = useState<"solicitacoes" | "pedidos" | "produtos">("solicitacoes");
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregandoDados(true);
    const [{ data: reqs, error: reqErro }, { data: peds, error: pedErro }] = await Promise.all([
      supabase
        .from("client_type_requests")
        .select("id, user_id, tipo_solicitado, status, criado_em, profiles(nome, sobrenome, email)")
        .order("criado_em", { ascending: false }),
      supabase
        .from("orders")
        .select(
          "id, status, total, criado_em, usuario_id, profiles(nome, sobrenome, email), order_items(id, quantidade)",
        )
        .order("criado_em", { ascending: false }),
    ]);
    setErro(reqErro?.message ?? pedErro?.message ?? null);
    setSolicitacoes((reqs ?? []) as unknown as Solicitacao[]);
    setPedidos((peds ?? []) as unknown as Pedido[]);
    setCarregandoDados(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void carregar();
  }, [isAdmin, carregar]);

  async function decidir(s: Solicitacao, aprovar: boolean) {
    setOcupado(s.id);
    setErro(null);
    try {
      if (aprovar) {
        const { error } = await supabase
          .from("user_client_types")
          .upsert(
            { user_id: s.user_id, tipo: s.tipo_solicitado as "varejo" | "atacado" | "dropshipping" },
            { onConflict: "user_id" },
          );
        if (error) throw new Error(error.message);
      }
      const { error: upErro } = await supabase
        .from("client_type_requests")
        .update({ status: aprovar ? "aprovado" : "recusado", decidido_em: new Date().toISOString() })
        .eq("id", s.id);
      if (upErro) throw new Error(upErro.message);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setOcupado(null);
    }
  }

  async function mudarStatus(pedido: Pedido, status: string) {
    setOcupado(pedido.id);
    const { error } = await supabase
      .from("orders")
      .update({ status: status as (typeof STATUS_PEDIDO)[number] })
      .eq("id", pedido.id);
    if (error) setErro(error.message);
    else await carregar();
    setOcupado(null);
  }

  async function virarAdmin() {
    setOcupado("claim");
    setErro(null);
    try {
      await claimFirstAdmin();
      window.location.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ativar o acesso.");
      setOcupado(null);
    }
  }

  if (carregandoUsuario || carregandoPapel) {
    return <Aviso titulo="Carregando..." texto="" />;
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">
          {jaTemAdmin === false
            ? "Esta área é só para administradores. Se você é o dono da loja e ainda não há nenhum administrador, ative seu acesso abaixo."
            : "Esta área é só para administradores. Peça acesso ao responsável pela loja."}
        </p>
        {jaTemAdmin === false ? (
          <button
            type="button"
            onClick={virarAdmin}
            disabled={ocupado === "claim"}
            className="cursor-pointer rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
          >
            {ocupado === "claim" ? "Ativando..." : "Tornar-me administrador"}
          </button>
        ) : null}
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
        <Link to="/" className="text-sm underline underline-offset-4">
          Voltar para a loja
        </Link>
      </main>
    );
  }

  const pendentes = solicitacoes.filter((s) => s.status === "pendente");

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Painel administrativo</h1>
          <p className="text-sm text-muted-foreground">Aprovações de conta e pedidos da loja.</p>
        </div>
        <Link to="/" className="cursor-pointer text-sm underline underline-offset-4">
          Voltar para a loja
        </Link>
      </header>

      <div className="mb-6 flex gap-2">
        {(
          [
            ["solicitacoes", `Solicitações${pendentes.length ? ` (${pendentes.length})` : ""}`],
            ["pedidos", `Pedidos${pedidos.length ? ` (${pedidos.length})` : ""}`],
            ["produtos", "Produtos"],
          ] as const
        ).map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            onClick={() => setAba(chave)}
            className={`cursor-pointer rounded-full px-4 py-2 text-sm transition-colors ${
              aba === chave
                ? "bg-foreground text-background"
                : "bg-muted text-foreground hover:bg-muted/70"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {erro ? <p className="mb-4 text-sm text-destructive">{erro}</p> : null}
      {carregandoDados ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}

      {aba === "solicitacoes" ? (
        <section className="overflow-hidden rounded-2xl border border-border">
          {solicitacoes.length === 0 && !carregandoDados ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma solicitação por enquanto.</p>
          ) : null}
          <ul className="divide-y divide-border">
            {solicitacoes.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.profiles ? `${s.profiles.nome} ${s.profiles.sobrenome}` : "Cliente"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.profiles?.email} · pediu <strong>{s.tipo_solicitado}</strong> em{" "}
                    {dataCurta(s.criado_em)}
                  </p>
                </div>
                {s.status === "pendente" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={ocupado === s.id}
                      onClick={() => decidir(s, true)}
                      className="cursor-pointer rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      disabled={ocupado === s.id}
                      onClick={() => decidir(s, false)}
                      className="cursor-pointer rounded-full bg-muted px-4 py-2 text-xs font-medium transition-colors hover:bg-muted/70 disabled:opacity-60"
                    >
                      Recusar
                    </button>
                  </div>
                ) : (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize text-muted-foreground">
                    {s.status}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : aba === "pedidos" ? (
        <section className="overflow-hidden rounded-2xl border border-border">
          {pedidos.length === 0 && !carregandoDados ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          ) : null}
          <ul className="divide-y divide-border">
            {pedidos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {p.profiles ? `${p.profiles.nome} ${p.profiles.sobrenome}` : "Cliente"} ·{" "}
                    {brl(Number(p.total))}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dataCurta(p.criado_em)} ·{" "}
                    {p.order_items?.reduce((soma, item) => soma + item.quantidade, 0) ?? 0} item(ns)
                    · #{p.id.slice(0, 8)}
                  </p>
                </div>
                <select
                  value={p.status}
                  disabled={ocupado === p.id}
                  onChange={(event) => mudarStatus(p, event.target.value)}
                  className="cursor-pointer rounded-full border border-border bg-background px-3 py-2 text-xs capitalize"
                >
                  {STATUS_PEDIDO.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <AdminProdutos />
      )}
    </main>
  );
}
