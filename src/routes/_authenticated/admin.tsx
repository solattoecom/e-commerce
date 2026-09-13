import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, MapPin, CreditCard } from "lucide-react";

import { AdminProdutos } from "@/components/AdminProdutos";

import { supabase } from "@/integrations/supabase/external";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAdminExists } from "@/hooks/useAdminExists";
import { claimFirstAdmin } from "@/lib/admin.functions";
import { enviarEmailStatusPedido } from "@/lib/email.functions";

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

type PedidoItem = {
  id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  products: { nome: string; product_images: { url: string }[] } | null;
  product_variants: { tamanho: string } | null;
};

type Pedido = {
  id: string;
  status: string;
  subtotal: number;
  frete: number;
  total: number;
  payment_method: string | null;
  nota_fiscal: string | null;
  codigo_rastreio: string | null;
  criado_em: string;
  usuario_id: string;
  endereco: Record<string, string>;
  profiles: { nome: string; sobrenome: string; email: string } | null;
  order_items: PedidoItem[];
};

type Cupom = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  criado_em: string;
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
  const [aba, setAba] = useState<"solicitacoes" | "pedidos" | "produtos" | "cupons">("solicitacoes");
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [nfePorPedido, setNfePorPedido] = useState<Record<string, string>>({});
  const [rastreioPorPedido, setRastreioPorPedido] = useState<Record<string, string>>({});
  const [expandido, setExpandido] = useState<string | null>(null);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [novoCupom, setNovoCupom] = useState({
    code: "",
    type: "percent" as "percent" | "fixed",
    value: "",
    expires_at: "",
    max_uses: "",
  });
  const [cupomErro, setCupomErro] = useState<string | null>(null);
  const [cupomSucesso, setCupomSucesso] = useState<string | null>(null);

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
          "id, status, subtotal, frete, total, payment_method, nota_fiscal, codigo_rastreio, criado_em, usuario_id, endereco, profiles(nome, sobrenome, email), order_items(id, quantidade, preco_unitario, subtotal, products(nome, product_images(url)), product_variants(tamanho))",
        )
        .order("criado_em", { ascending: false }),
    ]);
    setErro(reqErro?.message ?? pedErro?.message ?? null);
    setSolicitacoes((reqs ?? []) as unknown as Solicitacao[]);
    setPedidos((peds ?? []) as unknown as Pedido[]);
    supabase
      .from("coupons")
      .select("id, code, type, value, expires_at, max_uses, used_count, active, criado_em")
      .order("criado_em", { ascending: false })
      .then(({ data }) => setCupons((data as Cupom[]) ?? []));
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

  async function mudarStatus(pedido: Pedido, status: string, nfe?: string, rastreio?: string) {
    setOcupado(pedido.id);
    const payload: Record<string, unknown> = { status: status as (typeof STATUS_PEDIDO)[number] };
    if (status === "enviado") {
      if (nfe?.trim()) payload.nota_fiscal = nfe.trim();
      if (rastreio?.trim()) payload.codigo_rastreio = rastreio.trim();
    }
    const { error } = await supabase
      .from("orders")
      .update(payload)
      .eq("id", pedido.id);
    if (error) setErro(error.message);
    else {
      setNfePorPedido((prev) => { const next = { ...prev }; delete next[pedido.id]; return next; });
      if (pedido.profiles?.email) {
        void enviarEmailStatusPedido({
          email: pedido.profiles.email,
          nome: pedido.profiles.nome,
          pedido_id: pedido.id,
          status,
          codigo_rastreio: rastreio?.trim() || null,
        }).catch(() => {});
      }
      await carregar();
    }
    setOcupado(null);
  }

  const handleCriarCupom = async () => {
    setCupomErro(null);
    setCupomSucesso(null);
    if (!novoCupom.code.trim() || !novoCupom.value) {
      setCupomErro("Código e valor são obrigatórios.");
      return;
    }
    const { error } = await supabase.from("coupons").insert({
      code: novoCupom.code.trim().toUpperCase(),
      type: novoCupom.type,
      value: Number(novoCupom.value),
      expires_at: novoCupom.expires_at || null,
      max_uses: novoCupom.max_uses ? Number(novoCupom.max_uses) : null,
    });
    if (error) {
      setCupomErro(error.message.includes("unique") ? "Já existe um cupom com esse código." : error.message);
      return;
    }
    setCupomSucesso("Cupom criado!");
    setNovoCupom({ code: "", type: "percent", value: "", expires_at: "", max_uses: "" });
    const { data } = await supabase
      .from("coupons")
      .select("id, code, type, value, expires_at, max_uses, used_count, active, criado_em")
      .order("criado_em", { ascending: false });
    setCupons((data as Cupom[]) ?? []);
  };

  const handleToggleCupom = async (id: string, active: boolean) => {
    await supabase.from("coupons").update({ active: !active }).eq("id", id);
    setCupons((prev) => prev.map((c) => (c.id === id ? { ...c, active: !active } : c)));
  };

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
            ["cupons", "Cupons"],
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
            {pedidos.map((p) => {
              const statusSelecionado = p.status;
              const nfeAtual = nfePorPedido[p.id] ?? "";
              const rastreioAtual = rastreioPorPedido[p.id] ?? "";
              const isOpen = expandido === p.id;
              const end = p.endereco ?? {};
              return (
                <li key={p.id} className="divide-y divide-border">
                  {/* Linha clicável */}
                  <button
                    type="button"
                    onClick={() => setExpandido(isOpen ? null : p.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                  >
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs capitalize text-muted-foreground">{p.status}</span>
                      {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Detalhes expandidos */}
                  {isOpen && (
                    <div className="space-y-4 bg-muted/10 px-4 pb-5 pt-4 text-sm">

                      {/* Cliente */}
                      <div>
                        <p className="font-semibold mb-1">Cliente</p>
                        <p className="text-muted-foreground">{p.profiles ? `${p.profiles.nome} ${p.profiles.sobrenome}` : "—"}</p>
                        <p className="text-muted-foreground">{p.profiles?.email}</p>
                      </div>

                      {/* Data e pagamento */}
                      <div className="flex flex-wrap gap-4 text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="size-4 shrink-0" />
                          {p.payment_method === "pix" ? "Pix" : "Cartão de crédito"}
                        </span>
                        <span className="font-mono text-xs">{p.id}</span>
                      </div>

                      {/* Produtos */}
                      <div>
                        <p className="font-semibold mb-2">Produtos</p>
                        <div className="space-y-2">
                          {p.order_items.map((item) => (
                            <div key={item.id} className="flex items-center gap-3">
                              <div className="size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                                {item.products?.product_images?.[0]?.url ? (
                                  <img src={item.products.product_images[0].url} alt="" className="h-full w-full object-contain" />
                                ) : null}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{item.products?.nome}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.product_variants?.tamanho ? `Nº ${item.product_variants.tamanho} · ` : ""}
                                  Qtd: {item.quantidade}
                                </p>
                              </div>
                              <p className="shrink-0 font-semibold">{brl(Number(item.subtotal))}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Totais */}
                      <div className="rounded-xl border border-border p-3 space-y-1 text-xs">
                        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{brl(Number(p.subtotal))}</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>Frete</span><span>{Number(p.frete) === 0 ? "Grátis" : brl(Number(p.frete))}</span></div>
                        <div className="flex justify-between border-t border-border pt-1 font-semibold text-sm"><span>Total</span><span>{brl(Number(p.total))}</span></div>
                      </div>

                      {/* Endereço */}
                      {end["rua"] ? (
                        <div>
                          <p className="mb-1 flex items-center gap-1.5 font-semibold">
                            <MapPin className="size-4" /> Endereço de entrega
                          </p>
                          <div className="rounded-xl bg-muted/40 p-3 text-muted-foreground text-xs space-y-0.5">
                            <p>{end["rua"]}, {end["numero"]}{end["complemento"] ? `, ${end["complemento"]}` : ""}</p>
                            <p>{end["bairro"]}</p>
                            <p>{end["cidade"]} — {end["estado"]}</p>
                            <p>CEP {end["cep"]?.slice(0, 5)}-{end["cep"]?.slice(5)}</p>
                          </div>
                        </div>
                      ) : null}

                      {/* Alterar status */}
                      <div>
                        <p className="font-semibold mb-2">Alterar status</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={statusSelecionado}
                            disabled={ocupado === p.id}
                            onChange={(event) => {
                              const novoStatus = event.target.value;
                              if (novoStatus !== "enviado") {
                                void mudarStatus(p, novoStatus);
                              } else {
                                setPedidos((prev) =>
                                  prev.map((item) =>
                                    item.id === p.id ? { ...item, status: novoStatus } : item,
                                  ),
                                );
                              }
                            }}
                            className="cursor-pointer rounded-full border border-border bg-background px-3 py-2 text-xs capitalize"
                          >
                            {STATUS_PEDIDO.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                          {statusSelecionado === "enviado" && (
                            <>
                              <input
                                type="text"
                                placeholder="Número NF-e"
                                value={nfeAtual}
                                onChange={(event) =>
                                  setNfePorPedido((prev) => ({ ...prev, [p.id]: event.target.value }))
                                }
                                className="rounded-full border border-border bg-background px-3 py-2 text-xs"
                              />
                              <input
                                type="text"
                                placeholder="Código de rastreio"
                                value={rastreioAtual}
                                onChange={(event) =>
                                  setRastreioPorPedido((prev) => ({ ...prev, [p.id]: event.target.value }))
                                }
                                className="rounded-full border border-border bg-background px-3 py-2 text-xs"
                              />
                              <button
                                type="button"
                                disabled={ocupado === p.id}
                                onClick={() => mudarStatus(p, "enviado", nfeAtual, rastreioAtual)}
                                className="cursor-pointer rounded-full bg-foreground px-3 py-2 text-xs font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
                              >
                                Salvar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : aba === "produtos" ? (
        <AdminProdutos />
      ) : aba === "cupons" ? (
        <section className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border p-5 space-y-4">
            <h3 className="font-semibold">Novo cupom</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="mb-1 block text-xs text-muted-foreground">Código *</label>
                <input
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm uppercase"
                  placeholder="SOLATTO10"
                  value={novoCupom.code}
                  onChange={(e) => setNovoCupom((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Tipo *</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={novoCupom.type}
                  onChange={(e) => setNovoCupom((p) => ({ ...p, type: e.target.value as "percent" | "fixed" }))}
                >
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Valor * {novoCupom.type === "percent" ? "(%)" : "(R$)"}
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  placeholder={novoCupom.type === "percent" ? "10" : "20.00"}
                  value={novoCupom.value}
                  onChange={(e) => setNovoCupom((p) => ({ ...p, value: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Validade (opcional)</label>
                <input
                  type="datetime-local"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={novoCupom.expires_at}
                  onChange={(e) => setNovoCupom((p) => ({ ...p, expires_at: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Limite de usos (opcional)</label>
                <input
                  type="number"
                  min="1"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  placeholder="100"
                  value={novoCupom.max_uses}
                  onChange={(e) => setNovoCupom((p) => ({ ...p, max_uses: e.target.value }))}
                />
              </div>
            </div>
            {cupomErro ? <p className="text-sm text-destructive">{cupomErro}</p> : null}
            {cupomSucesso ? <p className="text-sm text-green-600">{cupomSucesso}</p> : null}
            <button
              type="button"
              onClick={handleCriarCupom}
              className="cursor-pointer rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background hover:bg-foreground/85"
            >
              Criar cupom
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border">
            {cupons.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nenhum cupom cadastrado ainda.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Código</th>
                    <th className="px-4 py-3 text-left font-medium">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium">Valor</th>
                    <th className="px-4 py-3 text-left font-medium">Validade</th>
                    <th className="px-4 py-3 text-left font-medium">Usos</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cupons.map((c) => (
                    <tr key={c.id} className={!c.active ? "opacity-50" : ""}>
                      <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.type === "percent" ? "%" : "R$"}
                      </td>
                      <td className="px-4 py-3">
                        {c.type === "percent" ? `${c.value}%` : Number(c.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString("pt-BR") : "Sem validade"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.used_count}{c.max_uses !== null ? `/${c.max_uses}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {c.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleCupom(c.id, c.active)}
                          className="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold bg-muted hover:bg-muted/70"
                        >
                          {c.active ? "Desativar" : "Ativar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
