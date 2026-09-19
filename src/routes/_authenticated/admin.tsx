import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, MapPin, CreditCard, Truck, Check } from "lucide-react";

import { AdminProdutos } from "@/components/AdminProdutos";

import { supabase } from "@/integrations/supabase/external";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAdminExists } from "@/hooks/useAdminExists";
import { claimFirstAdmin } from "@/lib/admin.functions";
import { notificarMudancaStatus } from "@/lib/email.functions";
import { generateLabel, getMelhorEnvioSaldo, reprintLabel } from "@/lib/label.functions";
import { getTrackingEvents, getTrackingByCode, type TrackingEvent } from "@/lib/tracking.functions";

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
  nome: string;
  email: string;
};

type PedidoItem = {
  id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  products: { nome: string; slug: string; product_images: { url: string }[] } | null;
  product_variants: { tamanho: string } | null;
};

type Pedido = {
  id: string;
  status: string;
  subtotal: number;
  frete: number;
  total: number;
  coupon_id: string | null;
  payment_method: string | null;
  card_parcelas: number | null;
  nota_fiscal: string | null;
  codigo_rastreio: string | null;
  label_pdf_url: string | null;
  me_service_id: number | null;
  me_order_id: string | null;
  ultimo_evento_rastreio: string | null;
  criado_em: string;
  usuario_id: string;
  endereco: Record<string, string>;
  profiles: { nome: string; email: string } | null;
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

const ME_STATUS: Record<string, string> = {
  posted: "Objeto postado",
  in_transit: "Em trânsito",
  delivered: "Entregue ao destinatário",
  undelivered: "Tentativa de entrega não realizada",
  canceled: "Envio cancelado",
  expired: "Envio expirado",
};
const traduzirStatusME = (s: string) => ME_STATUS[s.toLowerCase()] ?? s;

const TRACKING_STEPS = [
  { status: "posted",     label: "Postado" },
  { status: "in_transit", label: "Em trânsito" },
  { status: "delivered",  label: "Entregue" },
] as const;

function TrackingTimeline({ status }: { status: string | null }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const currentIndex = TRACKING_STEPS.findIndex((t) => t.status === s);
  if (currentIndex === -1) return <p className="text-xs text-muted-foreground">{traduzirStatusME(status)}</p>;

  return (
    <div className="relative flex items-start justify-between gap-1">
      {TRACKING_STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step.status} className="relative flex flex-1 flex-col items-center gap-1.5">
            {i < TRACKING_STEPS.length - 1 && (
              <div className={`absolute left-1/2 top-3.5 h-px w-full -translate-y-1/2 ${i <= currentIndex - 1 ? "bg-foreground" : "bg-border"}`} />
            )}
            <div className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors
              ${done ? "border-foreground bg-foreground text-background"
                : active ? "border-foreground bg-background text-foreground"
                : "border-border bg-background text-muted-foreground"}`}>
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <p className={`text-center text-[10px] leading-tight ${active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground"}`}>
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function totalCobrado(p: Pedido): number {
  if (p.card_parcelas && p.card_parcelas >= 11) {
    const taxa = 0.0199;
    const n = p.card_parcelas;
    const parcela = p.total * (taxa * Math.pow(1 + taxa, n)) / (Math.pow(1 + taxa, n) - 1);
    return Math.round(parcela * n * 100) / 100;
  }
  return Number(p.total);
}

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
  const [aba, setAba] = useState<"dashboard" | "solicitacoes" | "pedidos" | "produtos" | "cupons" | "relatorios">("dashboard");
  const [periodoRelatorio, setPeriodoRelatorio] = useState<7 | 30 | 90 | 365>(30);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [nfePorPedido, setNfePorPedido] = useState<Record<string, string>>({});
  const [rastreioPorPedido, setRastreioPorPedido] = useState<Record<string, string>>({});
  const [statusPorPedido, setStatusPorPedido] = useState<Record<string, string>>({});
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
  const [editandoCupom, setEditandoCupom] = useState<string | null>(null);
  const [editCupom, setEditCupom] = useState({ expires_at: "", max_uses: "" });
  const [labelPorPedido, setLabelPorPedido] = useState<Record<string, { pdf_url: string; codigo_rastreio: string }>>({});
  const [labelErroPorPedido, setLabelErroPorPedido] = useState<Record<string, string>>({});
  const [labelOcupado, setLabelOcupado] = useState<string | null>(null);
  const [reprintOcupado, setReprintOcupado] = useState<string | null>(null);
  const [saldoME, setSaldoME] = useState<number | null>(null);
  const [trackingEventsByOrder, setTrackingEventsByOrder] = useState<Record<string, TrackingEvent[]>>({});
  const [trackingLoadingByOrder, setTrackingLoadingByOrder] = useState<Record<string, boolean>>({});
  const [trackingStatusByOrder, setTrackingStatusByOrder] = useState<Record<string, string>>({});
  const [trackingCodeEventsByOrder, setTrackingCodeEventsByOrder] = useState<Record<string, TrackingEvent[]>>({});
  const [trackingCodeLoadingByOrder, setTrackingCodeLoadingByOrder] = useState<Record<string, boolean>>({});

  const carregar = useCallback(async () => {
    setCarregandoDados(true);
    const [{ data: reqs, error: reqErro }, { data: peds, error: pedErro }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.rpc as any)("get_confirmed_client_type_requests"),
      supabase
        .from("orders")
        .select(
          "id, status, subtotal, frete, total, coupon_id, payment_method, card_parcelas, nota_fiscal, codigo_rastreio, label_pdf_url, me_service_id, me_order_id, ultimo_evento_rastreio, criado_em, usuario_id, endereco, profiles(nome, email), order_items(id, quantidade, preco_unitario, subtotal, products(nome, slug, product_images(url)), product_variants(tamanho))",
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
    getMelhorEnvioSaldo().then(({ saldo }) => setSaldoME(saldo)).catch(() => {});
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
    const payload: { status: (typeof STATUS_PEDIDO)[number]; nota_fiscal?: string; codigo_rastreio?: string } = { status: status as (typeof STATUS_PEDIDO)[number] };
    if (status === "enviado") {
      if (nfe?.trim()) payload.nota_fiscal = nfe.trim();
      if (rastreio?.trim()) payload.codigo_rastreio = rastreio.trim();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from("orders")
      .update(payload as any)
      .eq("id", pedido.id);
    if (error) setErro(error.message);
    else {
setNfePorPedido((prev) => { const next = { ...prev }; delete next[pedido.id]; return next; });
      setStatusPorPedido((prev) => { const next = { ...prev }; delete next[pedido.id]; return next; });
      setRastreioPorPedido((prev) => { const next = { ...prev }; delete next[pedido.id]; return next; });
      void notificarMudancaStatus({ data: {
        order_id: pedido.id,
        status,
        codigo_rastreio: rastreio?.trim() || null,
      } }).catch((e) => { console.error("Erro ao notificar status:", e); });
      await carregar();
    }
    setOcupado(null);
  }

  async function handleLoadTracking(orderId: string, meOrderId: string, codigoRastreio?: string | null) {
    if (trackingEventsByOrder[orderId] !== undefined) return;
    setTrackingLoadingByOrder((prev) => ({ ...prev, [orderId]: true }));
    try {
      const result = await getTrackingEvents({ data: { me_order_id: meOrderId } });
      if (result.status) {
        setTrackingStatusByOrder((prev) => ({ ...prev, [orderId]: result.status! }));
      }
      if (result.events.length > 0) {
        setTrackingEventsByOrder((prev) => ({ ...prev, [orderId]: result.events }));
      } else if (codigoRastreio) {
        const correiosEvents = await getTrackingByCode({ data: { codigo: codigoRastreio } });
        setTrackingEventsByOrder((prev) => ({ ...prev, [orderId]: correiosEvents }));
        if (!result.status && correiosEvents.length > 0) {
          const desc = correiosEvents[0].descricao.toLowerCase();
          const correiosStatus =
            desc.includes("entregue") ? "delivered" :
            desc.includes("trânsito") || desc.includes("transito") || desc.includes("encaminhado") || desc.includes("saiu") ? "in_transit" :
            "posted";
          setTrackingStatusByOrder((prev) => ({ ...prev, [orderId]: correiosStatus }));
        }
      } else {
        setTrackingEventsByOrder((prev) => ({ ...prev, [orderId]: [] }));
      }
    } catch {
      setTrackingEventsByOrder((prev) => ({ ...prev, [orderId]: [] }));
    } finally {
      setTrackingLoadingByOrder((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
    }
  }

  async function handleLoadTrackingByCode(orderId: string, codigo: string) {
    if (trackingCodeEventsByOrder[orderId] !== undefined) return;
    setTrackingCodeLoadingByOrder((prev) => ({ ...prev, [orderId]: true }));
    try {
      const events = await getTrackingByCode({ data: { codigo } });
      setTrackingCodeEventsByOrder((prev) => ({ ...prev, [orderId]: events }));
    } catch {
      setTrackingCodeEventsByOrder((prev) => ({ ...prev, [orderId]: [] }));
    } finally {
      setTrackingCodeLoadingByOrder((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
    }
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
      expires_at: novoCupom.expires_at ? new Date(novoCupom.expires_at).toISOString() : null,
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

  const handleSalvarEdicaoCupom = async (id: string) => {
    const expiresAt = editCupom.expires_at ? new Date(editCupom.expires_at).toISOString() : null;
    const { error } = await supabase.from("coupons").update({
      expires_at: expiresAt,
      max_uses: editCupom.max_uses ? Number(editCupom.max_uses) : null,
    }).eq("id", id);
    if (error) return;
    setCupons((prev) => prev.map((c) => c.id === id ? {
      ...c,
      expires_at: expiresAt,
      max_uses: editCupom.max_uses ? Number(editCupom.max_uses) : null,
    } : c));
    setEditandoCupom(null);
  };

  async function handleGenerateLabel(pedidoId: string) {
    setLabelOcupado(pedidoId);
    setLabelErroPorPedido((prev) => { const next = { ...prev }; delete next[pedidoId]; return next; });
    try {
      const result = await generateLabel({ data: { order_id: pedidoId } });
      setLabelPorPedido((prev) => ({ ...prev, [pedidoId]: result }));
      getMelhorEnvioSaldo().then(({ saldo }) => setSaldoME(saldo)).catch(() => {});
      setTrackingEventsByOrder((prev) => { const n = { ...prev }; delete n[pedidoId]; return n; });
      await carregar();
      if (result.me_order_id) void handleLoadTracking(pedidoId, result.me_order_id);
    } catch (e) {
      setLabelErroPorPedido((prev) => ({
        ...prev,
        [pedidoId]: e instanceof Error ? e.message : "Erro ao gerar etiqueta.",
      }));
    } finally {
      setLabelOcupado(null);
    }
  }

  async function handleReprint(pedidoId: string) {
    setReprintOcupado(pedidoId);
    try {
      const result = await reprintLabel({ data: { order_id: pedidoId } });
      setLabelPorPedido((prev) => ({ ...prev, [pedidoId]: { ...prev[pedidoId], pdf_url: result.pdf_url } }));
      await carregar();
    } catch (e) {
      setLabelErroPorPedido((prev) => ({
        ...prev,
        [pedidoId]: e instanceof Error ? e.message : "Erro ao reimprimir etiqueta.",
      }));
    } finally {
      setReprintOcupado(null);
    }
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

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["dashboard", "Dashboard"],
            ["solicitacoes", `Solicitações${pendentes.length ? ` (${pendentes.length})` : ""}`],
            ["pedidos", `Pedidos${pedidos.length ? ` (${pedidos.length})` : ""}`],
            ["produtos", "Produtos"],
            ["cupons", "Cupons"],
            ["relatorios", "Relatórios"],
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

      {aba === "dashboard" ? (() => {
        const hoje = new Date().toDateString();
        const pedidosHoje = pedidos.filter((p) => new Date(p.criado_em).toDateString() === hoje);
        const vendasHoje = pedidosHoje.filter((p) => !["pendente", "cancelado"].includes(p.status)).reduce((s, p) => s + Number(p.total), 0);
        const totalGeral = pedidos.filter((p) => !["pendente", "cancelado"].includes(p.status)).reduce((s, p) => s + Number(p.total), 0);
        const qtdPendentes = pedidos.filter((p) => p.status === "pendente").length;
        const qtdAguardandoEnvio = pedidos.filter((p) => ["pago", "separando"].includes(p.status)).length;
        const cards = [
          { label: "Vendas hoje", value: brl(vendasHoje), sub: `${pedidosHoje.filter((p) => !["pendente","cancelado"].includes(p.status)).length} pedido(s)` },
          { label: "Aguardando envio", value: String(qtdAguardandoEnvio), sub: "pagos + separando" },
          { label: "Pendentes de pagamento", value: String(qtdPendentes), sub: "aguardando PIX/cartão" },
          { label: "Total recebido", value: brl(totalGeral), sub: `${pedidos.filter((p) => !["pendente","cancelado"].includes(p.status)).length} pedidos no total` },
        ];
        return (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="rounded-2xl border border-border bg-background p-5 space-y-1">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.sub}</p>
              </div>
            ))}
          </div>
        );
      })() : aba === "solicitacoes" ? (
        <section className="overflow-hidden rounded-2xl border border-border">
          {solicitacoes.length === 0 && !carregandoDados ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma solicitação por enquanto.</p>
          ) : null}
          <ul className="divide-y divide-border">
            {solicitacoes.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.nome || "Cliente"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.email} · pediu <strong>{s.tipo_solicitado}</strong> em{" "}
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
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["todos", ...STATUS_PEDIDO] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFiltroStatus(s)}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filtroStatus === s ? "bg-foreground text-background" : "bg-muted text-foreground hover:bg-muted/70"}`}
              >
                {s === "todos" ? `Todos (${pedidos.length})` : `${s} (${pedidos.filter((p) => p.status === s).length})`}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-2xl border border-border">
          {pedidos.length === 0 && !carregandoDados ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          ) : null}
          <ul className="divide-y divide-border">
            {pedidos.filter((p) => filtroStatus === "todos" || p.status === filtroStatus).map((p) => {
              const statusSelecionado = statusPorPedido[p.id] ?? p.status;
              const nfeAtual = nfePorPedido[p.id] ?? p.nota_fiscal ?? "";
              const rastreioAtual = rastreioPorPedido[p.id] ?? p.codigo_rastreio ?? "";
              const isOpen = expandido === p.id;
              const end = p.endereco ?? {};
              return (
                <li key={p.id} className="divide-y divide-border">
                  {/* Linha clicável */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = isOpen ? null : p.id;
                      setExpandido(next);
                      if (next && p.status === "enviado") {
                        if (p.me_order_id) void handleLoadTracking(p.id, p.me_order_id, p.codigo_rastreio);
                        else if (p.codigo_rastreio) void handleLoadTrackingByCode(p.id, p.codigo_rastreio);
                      }
                    }}
                    className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {p.profiles?.nome || "Cliente"} ·{" "}
                        {brl(totalCobrado(p))}
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
                        <p className="text-muted-foreground">{p.profiles?.nome || "—"}</p>
                        <p className="text-muted-foreground">{p.profiles?.email}</p>
                      </div>

                      {/* Data e pagamento */}
                      <div className="flex flex-wrap gap-4 text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="size-4 shrink-0" />
                          {p.payment_method === "pix"
                            ? "Pix (desconto 10%)"
                            : p.payment_method === "boleto"
                            ? "Boleto"
                            : p.card_parcelas && p.card_parcelas > 1
                            ? `Cartão — ${p.card_parcelas}x de ${brl(totalCobrado(p) / p.card_parcelas)}`
                            : "Cartão à vista"}
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
                        {p.payment_method === "pix" && (
                          <div className="flex justify-between text-green-600"><span>Desconto PIX (10%)</span><span>-{brl(Math.round((Number(p.total) - Number(p.frete)) / 0.9 * 0.1 * 100) / 100)}</span></div>
                        )}
                        {p.card_parcelas && p.card_parcelas >= 11 && (
                          <div className="flex justify-between text-amber-600"><span>Juros ({p.card_parcelas}x)</span><span>+{brl(totalCobrado(p) - Number(p.total))}</span></div>
                        )}
                        <div className="flex justify-between border-t border-border pt-1 font-semibold text-sm"><span>Total cobrado</span><span>{brl(totalCobrado(p))}</span></div>
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
                        <div className="flex flex-wrap items-start gap-2">
                          <select
                            value={statusSelecionado}
                            disabled={ocupado === p.id}
                            onChange={(event) => {
                              setStatusPorPedido((prev) => ({ ...prev, [p.id]: event.target.value }));
                            }}
                            className="cursor-pointer rounded-full border border-border bg-background px-3 py-2 text-xs capitalize"
                          >
                            {STATUS_PEDIDO.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                          {statusPorPedido[p.id] && statusPorPedido[p.id] !== p.status && statusPorPedido[p.id] !== "enviado" && (
                            <button
                              type="button"
                              disabled={ocupado === p.id}
                              onClick={() => mudarStatus(p, statusSelecionado)}
                              className="cursor-pointer rounded-full bg-foreground px-3 py-2 text-xs font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
                            >
                              Salvar
                            </button>
                          )}
                          {statusSelecionado === "enviado" && (
                            <>
                              <input
                                type="text"
                                placeholder="Número NF-e"
                                value={nfeAtual}
                                onChange={(event) =>
                                  setNfePorPedido((prev) => ({ ...prev, [p.id]: event.target.value }))
                                }
                                className="w-full rounded-full border border-border bg-background px-3 py-2 text-xs sm:w-auto"
                              />
                              <input
                                type="text"
                                placeholder="Código de rastreio"
                                value={rastreioAtual}
                                onChange={(event) =>
                                  setRastreioPorPedido((prev) => ({ ...prev, [p.id]: event.target.value }))
                                }
                                className="w-full rounded-full border border-border bg-background px-3 py-2 text-xs sm:w-auto"
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
                      {/* Etiqueta Melhor Envio */}
                      {p.me_service_id !== null && (() => {
                        const labelSessao = labelPorPedido[p.id];
                        const pdfUrl = labelSessao?.pdf_url ?? p.label_pdf_url;
                        const rastreio = labelSessao?.codigo_rastreio ?? p.codigo_rastreio;
                        const podeGerar = !p.me_order_id && (p.status === "pago" || p.status === "separando");
                        return (
                          <div>
                            <p className="font-semibold mb-2">Etiqueta de envio</p>
                            {pdfUrl && pdfUrl.startsWith("https://") ? (
                              <div className="space-y-2">
                                <a
                                  href={pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background hover:bg-foreground/85"
                                >
                                  Imprimir Etiqueta
                                </a>
                                {rastreio && (
                                  <p className="text-xs text-muted-foreground font-mono">Rastreio: {rastreio}</p>
                                )}
                              </div>
                            ) : p.me_order_id ? (
                              <div className="space-y-2">
                                <p className="text-xs text-destructive">URL do PDF inválida — clique para buscar novamente.</p>
                                <button
                                  type="button"
                                  disabled={reprintOcupado === p.id}
                                  onClick={() => handleReprint(p.id)}
                                  className="cursor-pointer rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
                                >
                                  {reprintOcupado === p.id ? "Buscando PDF…" : "Reimprimir Etiqueta"}
                                </button>
                                {rastreio && (
                                  <p className="text-xs text-muted-foreground font-mono">Rastreio: {rastreio}</p>
                                )}
                              </div>
                            ) : podeGerar ? (
                              <>
                                {Number(p.frete) > 0 && (
                                  <div className="mb-3 rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Custo estimado da etiqueta</span>
                                      <span className="font-semibold">{brl(Number(p.frete))}</span>
                                    </div>
                                    {saldoME !== null && (
                                      <>
                                        <div className="flex justify-between text-muted-foreground">
                                          <span>Saldo atual (ME)</span>
                                          <span className={saldoME < Number(p.frete) ? "text-destructive font-semibold" : ""}>{brl(saldoME)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-border pt-1">
                                          <span className="text-muted-foreground">Saldo após gerar</span>
                                          <span className={saldoME - Number(p.frete) < 0 ? "text-destructive font-semibold" : "font-semibold"}>
                                            {brl(saldoME - Number(p.frete))}
                                          </span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  disabled={labelOcupado === p.id}
                                  onClick={() => handleGenerateLabel(p.id)}
                                  className="cursor-pointer rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
                                >
                                  {labelOcupado === p.id ? "Gerando..." : "Gerar Etiqueta"}
                                </button>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {p.me_order_id ? "Etiqueta gerada — PDF não disponível." : "Pedido não está pago."}
                              </p>
                            )}
                            {labelErroPorPedido[p.id] && (
                              <p className="mt-1 text-xs text-destructive">{labelErroPorPedido[p.id]}</p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Rastreamento ao vivo */}
                      {p.status === "enviado" && p.me_order_id ? (
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 font-semibold">
                            <Truck className="size-4" /> Rastreamento
                          </p>
                          {(trackingStatusByOrder[p.id] ?? p.ultimo_evento_rastreio) ? (
                            <TrackingTimeline status={trackingStatusByOrder[p.id] ?? p.ultimo_evento_rastreio} />
                          ) : (
                            <p className="text-xs text-muted-foreground">Nenhum evento ainda.</p>
                          )}
                          {p.codigo_rastreio && (
                            <p className="mt-1 font-mono text-xs text-muted-foreground">{p.codigo_rastreio}</p>
                          )}
                        </div>
                      ) : p.status === "enviado" && p.codigo_rastreio ? (
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 font-semibold">
                            <Truck className="size-4" /> Rastreamento
                          </p>
                          <p className="mb-2 font-mono text-xs text-muted-foreground">{p.codigo_rastreio}</p>
                          {(trackingStatusByOrder[p.id] ?? p.ultimo_evento_rastreio) ? (
                            <TrackingTimeline status={trackingStatusByOrder[p.id] ?? p.ultimo_evento_rastreio} />
                          ) : (
                            <p className="text-xs text-muted-foreground">Nenhum evento ainda.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          </div>
        </section>
      ) : aba === "produtos" ? (
        <AdminProdutos />
      ) : aba === "cupons" ? (
        <section className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border p-5 space-y-4">
            <h3 className="font-semibold">Novo cupom</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-1">
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
              <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
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
                    <>
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
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditandoCupom(editandoCupom === c.id ? null : c.id);
                                setEditCupom({
                                  expires_at: c.expires_at ? c.expires_at.slice(0, 16) : "",
                                  max_uses: c.max_uses !== null ? String(c.max_uses) : "",
                                });
                              }}
                              className="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold bg-muted hover:bg-muted/70"
                            >
                              {editandoCupom === c.id ? "Cancelar" : "Editar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleCupom(c.id, c.active)}
                              className="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold bg-muted hover:bg-muted/70"
                            >
                              {c.active ? "Desativar" : "Ativar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editandoCupom === c.id ? (
                        <tr key={`${c.id}-edit`} className="bg-muted/20">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="flex flex-wrap items-end gap-3">
                              <div>
                                <label className="mb-1 block text-xs text-muted-foreground">Validade</label>
                                <input
                                  type="datetime-local"
                                  className="h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                                  value={editCupom.expires_at}
                                  onChange={(e) => setEditCupom((p) => ({ ...p, expires_at: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs text-muted-foreground">Limite de usos</label>
                                <input
                                  type="number"
                                  min="1"
                                  className="h-9 w-32 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                                  value={editCupom.max_uses}
                                  onChange={(e) => setEditCupom((p) => ({ ...p, max_uses: e.target.value }))}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSalvarEdicaoCupom(c.id)}
                                className="cursor-pointer rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background hover:bg-foreground/85"
                              >
                                Salvar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </section>
      ) : aba === "relatorios" ? (() => {
        const agora = new Date();
        const inicio = new Date(agora.getTime() - periodoRelatorio * 24 * 60 * 60 * 1000);
        const pedidosFiltrados = pedidos.filter(
          (p) => !["pendente", "cancelado"].includes(p.status) && new Date(p.criado_em) >= inicio,
        );
        const faturamento = pedidosFiltrados.reduce((s, p) => s + Number(p.total), 0);
        const ticketMedio = pedidosFiltrados.length > 0 ? faturamento / pedidosFiltrados.length : 0;

        const porMetodo: Record<string, { count: number; total: number }> = {};
        for (const p of pedidosFiltrados) {
          const m = p.payment_method ?? "outro";
          if (!porMetodo[m]) porMetodo[m] = { count: 0, total: 0 };
          porMetodo[m].count++;
          porMetodo[m].total += Number(p.total);
        }

        const porProduto: Record<string, { nome: string; quantidade: number; total: number }> = {};
        for (const p of pedidosFiltrados) {
          for (const item of p.order_items) {
            const nome = item.products?.nome ?? "Produto removido";
            if (!porProduto[nome]) porProduto[nome] = { nome, quantidade: 0, total: 0 };
            porProduto[nome].quantidade += item.quantidade;
            porProduto[nome].total += Number(item.subtotal);
          }
        }
        const topProdutos = Object.values(porProduto)
          .sort((a, b) => b.quantidade - a.quantidade)
          .slice(0, 10);

        const metodoLabel: Record<string, string> = { pix: "PIX", cartao: "Cartão", boleto: "Boleto" };

        return (
          <div className="space-y-8">
            <div className="flex flex-wrap gap-2">
              {([7, 30, 90, 365] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPeriodoRelatorio(d)}
                  className={`cursor-pointer rounded-full px-4 py-1.5 text-sm transition-colors ${
                    periodoRelatorio === d ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70"
                  }`}
                >
                  {d === 7 ? "7 dias" : d === 30 ? "30 dias" : d === 90 ? "90 dias" : "1 ano"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: "Faturamento", value: brl(faturamento) },
                { label: "Pedidos", value: String(pedidosFiltrados.length) },
                { label: "Ticket médio", value: brl(ticketMedio) },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl border border-border bg-background p-5 space-y-1">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold">{c.value}</p>
                </div>
              ))}
            </div>

            <section>
              <h2 className="mb-4 text-base font-semibold">Por método de pagamento</h2>
              <div className="overflow-hidden rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium">Método</th>
                      <th className="px-4 py-3 text-right font-medium">Pedidos</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Object.entries(porMetodo).length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">Nenhum pedido no período.</td></tr>
                    ) : (
                      Object.entries(porMetodo)
                        .sort(([, a], [, b]) => b.total - a.total)
                        .map(([m, v]) => (
                          <tr key={m}>
                            <td className="px-4 py-3">{metodoLabel[m] ?? m}</td>
                            <td className="px-4 py-3 text-right">{v.count}</td>
                            <td className="px-4 py-3 text-right font-medium">{brl(v.total)}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-base font-semibold">Produtos mais vendidos</h2>
              <div className="overflow-hidden rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium">#</th>
                      <th className="px-4 py-3 text-left font-medium">Produto</th>
                      <th className="px-4 py-3 text-right font-medium">Qtd.</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topProdutos.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">Nenhum produto vendido no período.</td></tr>
                    ) : (
                      topProdutos.map((p, i) => (
                        <tr key={p.nome}>
                          <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-3 font-medium">{p.nome}</td>
                          <td className="px-4 py-3 text-right">{p.quantidade}</td>
                          <td className="px-4 py-3 text-right">{brl(p.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        );
      })() : null}
    </main>
  );
}
