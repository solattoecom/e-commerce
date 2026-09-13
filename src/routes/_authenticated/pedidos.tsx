import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Package, ChevronDown, ChevronUp, MapPin, CreditCard, Truck, Hash } from "lucide-react";

import { supabase } from "@/integrations/supabase/external";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/pedidos")({
  component: PedidosPage,
});

type OrderStatus = "pendente" | "pago" | "separando" | "enviado" | "entregue" | "cancelado";

const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  pendente:  { label: "Pendente",  color: "bg-yellow-100 text-yellow-800" },
  pago:      { label: "Pago",      color: "bg-blue-100 text-blue-800" },
  separando: { label: "Separando", color: "bg-purple-100 text-purple-800" },
  enviado:   { label: "Enviado",   color: "bg-orange-100 text-orange-800" },
  entregue:  { label: "Entregue",  color: "bg-green-100 text-green-800" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800" },
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
  criado_em: string;
  endereco: Record<string, string>;
  coupons: { code: string; type: string; value: number } | null;
  order_items: OrderItem[];
};

const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PedidosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const { data } = await supabase
        .from("orders")
        .select(`
          id, status, subtotal, frete, total, desconto, payment_method, nota_fiscal, codigo_rastreio, criado_em, endereco,
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
                  onClick={() => setExpanded(isOpen ? null : order.id)}
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
                    {end.rua ? (
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
                    {order.codigo_rastreio ? (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 font-semibold">
                          <Truck className="size-4" /> Rastreamento
                        </p>
                        <div className="flex items-center gap-3">
                          <p className="font-mono text-muted-foreground">{order["codigo_rastreio"]}</p>
                          <a
                            href={`https://www.linketrack.com/trace/${order["codigo_rastreio"]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background hover:bg-foreground/85"
                          >
                            Rastrear
                          </a>
                        </div>
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
