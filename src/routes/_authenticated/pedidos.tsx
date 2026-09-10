import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Package } from "lucide-react";

import { supabase } from "@/integrations/supabase/external";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/pedidos")({
  component: PedidosPage,
});

type OrderStatus = "pendente" | "pago" | "separando" | "enviado" | "entregue" | "cancelado";

const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  pendente:   { label: "Pendente",   color: "bg-yellow-100 text-yellow-800" },
  pago:       { label: "Pago",       color: "bg-blue-100 text-blue-800" },
  separando:  { label: "Separando",  color: "bg-purple-100 text-purple-800" },
  enviado:    { label: "Enviado",    color: "bg-orange-100 text-orange-800" },
  entregue:   { label: "Entregue",   color: "bg-green-100 text-green-800" },
  cancelado:  { label: "Cancelado",  color: "bg-red-100 text-red-800" },
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
  payment_method: string | null;
  nota_fiscal: string | null;
  codigo_rastreio: string | null;
  criado_em: string;
  endereco: Record<string, string>;
  order_items: OrderItem[];
};

function PedidosPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const { data } = await supabase
        .from("orders")
        .select(`
          id, status, subtotal, frete, total, payment_method, nota_fiscal, codigo_rastreio, criado_em, endereco,
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

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Carregando pedidos...</p></div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold"><Package className="h-6 w-6" /> Meus Pedidos</h1>

      {orders.length === 0 ? (
        <p className="text-center text-muted-foreground">Você ainda não fez nenhum pedido.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const cfg = statusConfig[order.status] ?? statusConfig.pendente;
            const isOpen = expanded === order.id;
            const date = new Date(order.criado_em).toLocaleDateString("pt-BR");
            return (
              <div key={order.id} className="rounded-lg border">
                <button type="button" onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="flex w-full items-center justify-between p-4 text-left">
                  <div className="space-y-0.5">
                    <p className="font-medium">Pedido #{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-sm text-muted-foreground">{date} · R$ {order.total.toFixed(2).replace(".", ",")} · {order.payment_method === "pix" ? "Pix" : "Cartão"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-4 text-sm">
                    <div className="space-y-2">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                          {item.products?.product_images?.[0]?.url && (
                            <img src={item.products.product_images[0].url} alt="" className="h-12 w-12 rounded object-cover" />
                          )}
                          <div className="flex-1">
                            <p className="font-medium">{item.products?.nome}</p>
                            <p className="text-muted-foreground">{item.product_variants?.tamanho} · Qtd: {item.quantidade}</p>
                          </div>
                          <p className="font-medium">R$ {item.subtotal.toFixed(2).replace(".", ",")}</p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="font-medium mb-1">Endereço de entrega</p>
                      <p className="text-muted-foreground">{order.endereco.rua}, {order.endereco.numero}{order.endereco.complemento ? `, ${order.endereco.complemento}` : ""}</p>
                      <p className="text-muted-foreground">{order.endereco.bairro} — {order.endereco.cidade}/{order.endereco.estado} — CEP {order.endereco.cep?.slice(0, 5)}-{order.endereco.cep?.slice(5)}</p>
                    </div>

                    {order.nota_fiscal && (
                      <p className="text-muted-foreground">NF-e: <span className="font-mono font-medium">{order.nota_fiscal}</span></p>
                    )}
                    {order.codigo_rastreio && (
                      <div className="flex items-center gap-3">
                        <p className="text-muted-foreground">Rastreio: <span className="font-mono font-medium">{order.codigo_rastreio}</span></p>
                        <a
                          href={`https://www.linketrack.com/trace/${order.codigo_rastreio}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background hover:bg-foreground/85"
                        >
                          Rastrear
                        </a>
                      </div>
                    )}
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
