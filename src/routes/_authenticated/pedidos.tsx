import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Package, ChevronDown, ChevronUp, MapPin, CreditCard, Truck, Hash, Check, Copy, QrCode } from "lucide-react";

import { supabase } from "@/integrations/supabase/external";
import { useAuth } from "@/hooks/useAuth";
import { retryPixPayment, getOrderStatus, cancelOrder } from "@/lib/checkout.functions";
import { getTrackingEvents, getTrackingByCode, type TrackingEvent } from "@/lib/tracking.functions";

export const Route = createFileRoute("/_authenticated/pedidos")({
  component: PedidosPage,
});

type OrderStatus = "pendente" | "pago" | "separando" | "enviado" | "entregue" | "cancelado" | "expirado";

const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  pendente:  { label: "Pendente",  color: "bg-yellow-100 text-yellow-800" },
  pago:      { label: "Pago",      color: "bg-blue-100 text-blue-800" },
  separando: { label: "Separando", color: "bg-purple-100 text-purple-800" },
  enviado:   { label: "Enviado",   color: "bg-orange-100 text-orange-800" },
  entregue:  { label: "Entregue",  color: "bg-green-100 text-green-800" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800" },
  expirado:  { label: "Expirado",  color: "bg-gray-100 text-gray-600" },
};

type OrderItem = {
  id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  products: { nome: string; product_images: { url: string }[] } | null;
  product_variants: { tamanho: string } | null;
};

type Order = {
  id: string;
  status: OrderStatus;
  subtotal: number;
  frete: number;
  total: number;
  coupon_id: string | null;
  desconto: number;
  payment_method: string | null;
  nota_fiscal: string | null;
  codigo_rastreio: string | null;
  me_order_id: string | null;
  ultimo_evento_rastreio: string | null;
  criado_em: string;
  endereco: Record<string, string>;
  coupons: { code: string; type: string; value: number } | null;
  order_items: OrderItem[];
};

const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ME_STATUS: Record<string, string> = {
  posted: "Objeto postado",
  in_transit: "Em trânsito",
  delivered: "Entregue ao destinatário",
  undelivered: "Tentativa de entrega não realizada",
  canceled: "Envio cancelado",
  expired: "Envio expirado",
};
function traduzirStatusME(status: string): string {
  return ME_STATUS[status.toLowerCase()] ?? status;
}

function TrackingLink({ codigo }: { codigo: string | null }) {
  if (!codigo) return null;
  return (
    <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3">
      <p className="text-xs text-muted-foreground">Para detalhes sobre o rastreio do seu pedido, consulte o rastreio dos Correios.</p>
      <a
        href={`https://www.melhorrastreio.com.br/rastreio/${codigo}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-80 transition-opacity"
      >
        Rastrear no Melhor Rastreio
      </a>
    </div>
  );
}

const TRACKING_STEPS = [
  { status: "posted",     label: "Postado" },
  { status: "in_transit", label: "Em trânsito" },
  { status: "delivered",  label: "Entregue" },
] as const;

function TrackingTimeline({ status }: { status: string | null }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const currentIndex = TRACKING_STEPS.findIndex((t) => t.status === s);
  if (currentIndex === -1) return <p className="text-sm font-medium">{traduzirStatusME(status)}</p>;

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

const TIMELINE_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "pendente",  label: "Pedido feito" },
  { status: "pago",      label: "Pagamento confirmado" },
  { status: "separando", label: "Separando" },
  { status: "enviado",   label: "Enviado" },
  { status: "entregue",  label: "Entregue" },
];

function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelado") {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        Pedido cancelado
      </div>
    );
  }
  if (status === "expirado") {
    return (
      <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm font-medium text-gray-600">
        Pedido expirado — o prazo de pagamento encerrou e os itens foram devolvidos ao estoque.
      </div>
    );
  }

  const currentIndex = TIMELINE_STEPS.findIndex((s) => s.status === status);

  return (
    <div className="relative flex items-start justify-between gap-1">
      {TIMELINE_STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step.status} className="relative flex flex-1 flex-col items-center gap-1.5">
            {i < TIMELINE_STEPS.length - 1 && (
              <div className={`absolute left-1/2 top-3.5 h-px w-full -translate-y-1/2 ${i < currentIndex ? "bg-foreground" : "bg-border"}`} />
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

type PixState = { qr: string; qrCode: string; secondsLeft: number };

function PedidosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pixByOrder, setPixByOrder] = useState<Record<string, PixState>>({});
  const [pixBusy, setPixBusy] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);
  const [trackingEventsByOrder, setTrackingEventsByOrder] = useState<Record<string, TrackingEvent[]>>({});
  const [trackingLoadingByOrder, setTrackingLoadingByOrder] = useState<Record<string, boolean>>({});
  const [trackingCodeEventsByOrder, setTrackingCodeEventsByOrder] = useState<Record<string, TrackingEvent[]>>({});
  const [trackingCodeLoadingByOrder, setTrackingCodeLoadingByOrder] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const { data } = await supabase
        .from("orders")
        .select(`
          id, status, subtotal, frete, total, desconto, payment_method, nota_fiscal, codigo_rastreio, me_order_id, ultimo_evento_rastreio, criado_em, endereco,
          coupons(code, type, value),
          order_items(id, quantidade, preco_unitario, subtotal,
            products(nome, product_images(url)),
            product_variants(tamanho)
          )
        `)
        .eq("usuario_id", user.id)
        .order("criado_em", { ascending: false });
      setOrders((data as unknown as Order[]) ?? []);
      setLoading(false);
    })();
  }, [user?.id]);

  useEffect(() => {
    const ids = Object.keys(pixByOrder);
    if (ids.length === 0) return;
    const tick = setInterval(() => {
      setPixByOrder((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          if (next[id]) next[id] = { ...next[id], secondsLeft: Math.max(0, next[id].secondsLeft - 1) };
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [Object.keys(pixByOrder).join(",")]);

  async function handleRetryPix(orderId: string) {
    setPixBusy(orderId);
    try {
      const result = await retryPixPayment({ data: { order_id: orderId } });
      setPixByOrder((prev) => ({ ...prev, [orderId]: { qr: result.pix_qr, qrCode: result.pix_qr_code, secondsLeft: 3600 } }));

      let retries = 0;
      const interval = setInterval(async () => {
        try {
          const s = await getOrderStatus({ data: { order_id: orderId } });
          retries = 0;
          if (s.status === "pago") {
            clearInterval(interval);
            setPixByOrder((prev) => { const n = { ...prev }; delete n[orderId]; return n; });
            setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "pago" as OrderStatus } : o));
          }
        } catch { if (++retries >= 5) clearInterval(interval); }
      }, 3000);
      setTimeout(() => clearInterval(interval), 10 * 60 * 1000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao gerar PIX.");
    } finally {
      setPixBusy(null);
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

  async function handleLoadTracking(orderId: string, meOrderId: string) {
    if (trackingEventsByOrder[orderId] !== undefined) return;
    setTrackingLoadingByOrder((prev) => ({ ...prev, [orderId]: true }));
    try {
      const events = await getTrackingEvents({ data: { me_order_id: meOrderId } });
      setTrackingEventsByOrder((prev) => ({ ...prev, [orderId]: events }));
    } catch {
      setTrackingEventsByOrder((prev) => ({ ...prev, [orderId]: [] }));
    } finally {
      setTrackingLoadingByOrder((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
    }
  }

  async function handleCancelOrder(orderId: string) {
    if (!confirm("Tem certeza que deseja cancelar este pedido?")) return;
    setCancelBusy(orderId);
    try {
      await cancelOrder({ data: { order_id: orderId } });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "cancelado" as OrderStatus } : o));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao cancelar pedido.");
    } finally {
      setCancelBusy(null);
    }
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Carregando pedidos...</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold">
        <Package className="h-6 w-6" /> Meus Pedidos
      </h1>

      {orders.length === 0 ? (
        <p className="text-center text-muted-foreground">Você ainda não fez nenhum pedido.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const cfg = statusConfig[order.status] ?? statusConfig.pendente;
            const isOpen = expanded === order.id;
            const date = new Date(order.criado_em).toLocaleDateString("pt-BR");
            const end = order.endereco ?? {};
            const firstImage = order.order_items[0]?.products?.product_images?.[0]?.url;

            return (
              <div key={order.id} className="overflow-hidden rounded-xl border border-border">
                {/* Cabeçalho clicável */}
                <button
                  type="button"
                  onClick={() => {
                    const next = isOpen ? null : order.id;
                    setExpanded(next);
                    if (next && order.me_order_id) {
                      void handleLoadTracking(order.id, order.me_order_id);
                    } else if (next && order.codigo_rastreio) {
                      void handleLoadTrackingByCode(order.id, order.codigo_rastreio);
                    }
                  }}
                  className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/30"
                >
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {firstImage ? (
                      <img src={firstImage} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="size-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Pedido #{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {date} · {brl(order.total)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {order.order_items.length} item{order.order_items.length > 1 ? "s" : ""}
                      {order.payment_method ? ` · ${order.payment_method === "pix" ? "Pix" : "Cartão"}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Detalhes expandidos */}
                {isOpen && (
                  <div className="space-y-5 border-t border-border px-4 pb-5 pt-4 text-sm">

                    {/* Timeline de status */}
                    <OrderTimeline status={order.status} />

                    {/* Banner de pedido expirado */}
                    {order.status === "expirado" && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center space-y-3">
                        <p className="text-sm text-gray-600">O prazo de pagamento encerrou. Seus itens voltaram ao estoque.</p>
                        <a
                          href="/"
                          className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background hover:bg-foreground/90"
                        >
                          Fazer novo pedido
                        </a>
                      </div>
                    )}

                    {/* Botão cancelar para pedidos pendentes */}
                    {order.status === "pendente" && (
                      <button
                        type="button"
                        disabled={cancelBusy === order.id}
                        onClick={() => handleCancelOrder(order.id)}
                        className="w-full rounded-lg border border-red-200 bg-red-50 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
                      >
                        {cancelBusy === order.id ? "Cancelando..." : "Cancelar pedido"}
                      </button>
                    )}

                    {/* Retry PIX para pedidos pendentes */}
                    {order.status === "pendente" && order.payment_method === "pix" && (() => {
                      const pix = pixByOrder[order.id];
                      return (
                        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                          {pix ? (
                            <>
                              <p className="flex items-center gap-2 text-sm font-semibold"><QrCode className="size-4" /> QR Code Pix</p>
                              {pix.qrCode && <img src={pix.qrCode} alt="QR Code Pix" className="mx-auto h-44 w-44" />}
                              <p className="break-all font-mono text-xs text-muted-foreground">{pix.qr}</p>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(pix.qr).then(() => {
                                  const el = document.getElementById(`pix-copy-${order.id}`);
                                  if (el) { el.textContent = "Copiado!"; setTimeout(() => { el.textContent = "Copiar código Pix"; }, 2000); }
                                })}
                                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2 text-sm font-medium hover:bg-muted"
                              >
                                <Copy className="size-4" />
                                <span id={`pix-copy-${order.id}`}>Copiar código Pix</span>
                              </button>
                              {pix.secondsLeft > 0 ? (
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Expira em</span>
                                    <span className="font-mono">{String(Math.floor(pix.secondsLeft / 60)).padStart(2, "0")}:{String(pix.secondsLeft % 60).padStart(2, "0")}</span>
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <div className="h-full rounded-full bg-foreground transition-all duration-1000" style={{ width: `${(pix.secondsLeft / 3600) * 100}%` }} />
                                  </div>
                                </div>
                              ) : (
                                <p className="text-center text-xs font-medium text-destructive">QR Code expirado.</p>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={pixBusy === order.id}
                              onClick={() => handleRetryPix(order.id)}
                              className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
                            >
                              <QrCode className="size-4" />
                              {pixBusy === order.id ? "Gerando..." : "Pagar com Pix"}
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* ID completo */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Hash className="size-3.5 shrink-0" />
                      <span className="font-mono break-all">{order.id}</span>
                    </div>

                    {/* Data e pagamento */}
                    <div className="flex flex-wrap gap-4 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Hash className="size-4 shrink-0" />
                        {new Date(order.criado_em).toLocaleString("pt-BR")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CreditCard className="size-4 shrink-0" />
                        {order.payment_method === "pix" ? "Pix" : "Cartão de crédito"}
                      </span>
                    </div>

                    {/* Produtos */}
                    <div>
                      <p className="mb-3 font-semibold">Produtos</p>
                      <div className="space-y-3">
                        {order.order_items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3">
                            <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                              {item.products?.product_images?.[0]?.url ? (
                                <img src={item.products.product_images[0].url} alt="" className="h-full w-full object-contain" />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{item.products?.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.product_variants?.tamanho ? `Nº ${item.product_variants.tamanho} · ` : ""}
                                Qtd: {item.quantidade} · {brl(item.preco_unitario)} un.
                              </p>
                            </div>
                            <p className="shrink-0 font-semibold">{brl(item.subtotal)}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Totais */}
                    <div className="rounded-xl border border-border p-4 space-y-1.5">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{brl(order.subtotal)}</span>
                      </div>
                      {order.coupons && order.desconto > 0 ? (
                        <div className="flex justify-between text-green-600 font-medium">
                          <span>Cupom ({order.coupons.code})</span>
                          <span>-{brl(order.desconto)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-muted-foreground">
                        <span>Frete</span>
                        <span>{order.frete === 0 ? "Grátis" : brl(order.frete)}</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2 font-semibold">
                        <span>Total</span>
                        <span>{brl(order.total)}</span>
                      </div>
                    </div>

                    {/* Endereço */}
                    {end['rua'] ? (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 font-semibold">
                          <MapPin className="size-4" /> Endereço de entrega
                        </p>
                        <div className="rounded-xl bg-muted/40 p-4 text-muted-foreground space-y-0.5">
                          <p>{end["rua"]}, {end["numero"]}{end["complemento"] ? `, ${end["complemento"]}` : ""}</p>
                          <p>{end["bairro"]}</p>
                          <p>{end["cidade"]} — {end["estado"]}</p>
                          <p>CEP {end["cep"]?.slice(0, 5)}-{end["cep"]?.slice(5)}</p>
                        </div>
                      </div>
                    ) : null}

                    {/* Nota fiscal */}
                    {order.nota_fiscal ? (
                      <div>
                        <p className="font-semibold mb-1">Nota fiscal</p>
                        <p className="font-mono text-muted-foreground">{order["nota_fiscal"]}</p>
                      </div>
                    ) : null}

                    {/* Rastreio */}
                    {order.me_order_id ? (
                      <div>
                        <p className="mb-3 flex items-center gap-1.5 font-semibold">
                          <Truck className="size-4" /> Rastreamento
                        </p>
                        {order.status === "entregue" || order.ultimo_evento_rastreio ? (
                          <>
                            <TrackingTimeline status={order.status === "entregue" ? "delivered" : order.ultimo_evento_rastreio} />
                            <TrackingLink codigo={order.codigo_rastreio} />
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nenhum evento de rastreio ainda.</p>
                        )}
                      </div>
                    ) : order.codigo_rastreio ? (
                      <div>
                        <p className="mb-3 flex items-center gap-1.5 font-semibold">
                          <Truck className="size-4" /> Rastreamento
                        </p>
                        <p className="mb-3 font-mono text-xs text-muted-foreground">{order.codigo_rastreio}</p>
                        {trackingCodeLoadingByOrder[order.id] ? (
                          <p className="text-sm text-muted-foreground">Carregando eventos...</p>
                        ) : trackingCodeEventsByOrder[order.id]?.length ? (
                          <ol className="space-y-3">
                            {trackingCodeEventsByOrder[order.id]!.map((evento, idx) => (
                              <li key={idx} className="flex gap-3">
                                <div className="mt-0.5 flex flex-col items-center">
                                  <div className="size-2.5 rounded-full bg-foreground shrink-0" />
                                  {idx < trackingCodeEventsByOrder[order.id]!.length - 1 && (
                                    <div className="mt-1 w-px flex-1 bg-border" />
                                  )}
                                </div>
                                <div className="min-w-0 pb-3">
                                  <p className="text-sm font-medium leading-snug">{evento.descricao}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {evento.data}{evento.local ? ` — ${evento.local}` : ""}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        ) : trackingCodeEventsByOrder[order.id] !== undefined ? (
                          order.status === "entregue" || order.ultimo_evento_rastreio ? (
                            <>
                              <TrackingTimeline status={order.status === "entregue" ? "delivered" : order.ultimo_evento_rastreio} />
                              <TrackingLink codigo={order.codigo_rastreio} />
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">Nenhum evento encontrado ainda.</p>
                          )
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
