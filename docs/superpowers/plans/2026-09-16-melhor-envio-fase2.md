# Melhor Envio Fase 2 — Etiquetas + Rastreio em Tempo Real

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o ciclo logístico: gerar etiquetas via Melhor Envio direto do painel admin e exibir timeline de rastreio em tempo real na página de pedidos do cliente.

**Architecture:** Dois novos campos na tabela `orders` (`me_service_id`, `me_order_id`) conectam o serviço escolhido no checkout à geração de etiqueta. Duas server functions novas (`generateLabel`, `getTrackingEvents`) encapsulam as chamadas à API do Melhor Envio no servidor. UI no admin adiciona botão "Gerar Etiqueta"; UI em pedidos.tsx adiciona timeline vertical lazy-loaded ao expandir o pedido.

**Tech Stack:** TanStack Start `createServerFn`, Supabase, Melhor Envio REST API v2, React, TypeScript, Tailwind CSS.

---

## File Map

| Arquivo | Ação |
|---|---|
| `supabase/migrations/20260916120000_me_columns.sql` | Criar — adiciona `me_service_id` e `me_order_id` à tabela `orders` |
| `src/integrations/supabase/types.ts` | Modificar — adiciona campos ao tipo `orders.Row/Insert/Update` |
| `src/lib/shipping.functions.ts` | Modificar — adiciona `me_service_id` em `ShippingOption` e no mapeador |
| `src/lib/checkout.functions.ts` | Modificar — salva `me_service_id` ao criar pedido |
| `src/lib/label.functions.ts` | Criar — `generateLabel` server function |
| `src/lib/tracking.functions.ts` | Criar — `getTrackingEvents` server function |
| `src/routes/_authenticated/admin.tsx` | Modificar — botão "Gerar Etiqueta" + link PDF |
| `src/routes/_authenticated/pedidos.tsx` | Modificar — timeline de rastreio em tempo real |

---

## Task 1: Migration SQL + Atualizar types.ts

**Files:**
- Create: `supabase/migrations/20260916120000_me_columns.sql`
- Modify: `src/integrations/supabase/types.ts` (linhas 285–367, bloco `orders`)

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- supabase/migrations/20260916120000_me_columns.sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS me_service_id integer,
  ADD COLUMN IF NOT EXISTS me_order_id text;

COMMENT ON COLUMN public.orders.me_service_id IS 'ID numérico do serviço Melhor Envio escolhido pelo cliente. Null para atacado/fallback.';
COMMENT ON COLUMN public.orders.me_order_id IS 'ID do pedido no Melhor Envio após geração da etiqueta. Usado para tracking e PDF.';
```

- [ ] **Step 2: Aplicar a migration no Supabase**

Abra o Supabase Studio > SQL Editor e execute o conteúdo do arquivo acima.
Ou via CLI: `npx supabase db push` (requer `supabase link` feito previamente).
Verifique: a tabela `orders` deve ter as colunas `me_service_id` (integer, nullable) e `me_order_id` (text, nullable).

- [ ] **Step 3: Atualizar `src/integrations/supabase/types.ts` — bloco `orders.Row`**

Localizar o bloco `orders: { Row: {` (por volta da linha 285). Adicionar os dois campos novos:

```typescript
// orders.Row — adicionar após `nota_fiscal: string | null`:
me_order_id: string | null
me_service_id: number | null
```

O bloco `Row` completo deve ficar:

```typescript
orders: {
  Row: {
    address_id: string | null
    atualizado_em: string
    codigo_rastreio: string | null
    comissao_percent: number
    comissao_valor: number
    coupon_id: string | null
    criado_em: string
    desconto: number
    endereco: Json
    frete: number
    id: string
    me_order_id: string | null
    me_service_id: number | null
    nota_fiscal: string | null
    payment_id: string | null
    payment_method: string | null
    status: Database["public"]["Enums"]["order_status"]
    subtotal: number
    total: number
    usuario_id: string
  }
```

- [ ] **Step 4: Atualizar `orders.Insert` e `orders.Update` no mesmo arquivo**

Em `Insert`, adicionar (campos opcionais):
```typescript
me_order_id?: string | null
me_service_id?: number | null
```

Em `Update`, adicionar:
```typescript
me_order_id?: string | null
me_service_id?: number | null
```

- [ ] **Step 5: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260916120000_me_columns.sql src/integrations/supabase/types.ts
git commit -m "feat: add me_service_id and me_order_id columns to orders"
```

---

## Task 2: Adicionar `me_service_id` em ShippingOption e no mapeador

**Files:**
- Modify: `src/lib/shipping.functions.ts`

- [ ] **Step 1: Adicionar `me_service_id` ao tipo `ShippingOption`**

Localizar (linha 3):
```typescript
export type ShippingOption = {
  id: string;
  nome: string;
  prazo: string;
  valor: number;
};
```

Substituir por:
```typescript
export type ShippingOption = {
  id: string;
  nome: string;
  prazo: string;
  valor: number;
  me_service_id?: number;
};
```

- [ ] **Step 2: Incluir `me_service_id` no retorno da função `mapear`**

Localizar dentro de `cotarMelhorEnvio` (por volta da linha 171):
```typescript
  const mapear = (s: MEServico, id: string): ShippingOption => {
    const preco = Number(s.custom_price ?? s.price ?? 0);
    const range = s.custom_delivery_range ?? s.delivery_range;
    const prazo = range
      ? `${range.min} a ${range.max} dias úteis`
      : `${s.delivery_time} dias úteis`;
    return {
      id,
      nome: id === "economico"
        ? (gratis ? "Entrega padrão (grátis)" : `${s.company.name} — ${s.name}`)
        : `${s.company.name} — ${s.name}`,
      prazo,
      valor: id === "economico" && gratis ? 0 : Number(preco.toFixed(2)),
    };
  };
```

Substituir pelo return dentro de `mapear` — adicionar `me_service_id: s.id`:
```typescript
  const mapear = (s: MEServico, id: string): ShippingOption => {
    const preco = Number(s.custom_price ?? s.price ?? 0);
    const range = s.custom_delivery_range ?? s.delivery_range;
    const prazo = range
      ? `${range.min} a ${range.max} dias úteis`
      : `${s.delivery_time} dias úteis`;
    return {
      id,
      nome: id === "economico"
        ? (gratis ? "Entrega padrão (grátis)" : `${s.company.name} — ${s.name}`)
        : `${s.company.name} — ${s.name}`,
      prazo,
      valor: id === "economico" && gratis ? 0 : Number(preco.toFixed(2)),
      me_service_id: s.id,
    };
  };
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shipping.functions.ts
git commit -m "feat: expose me_service_id in ShippingOption"
```

---

## Task 3: Salvar `me_service_id` ao criar pedido

**Files:**
- Modify: `src/lib/checkout.functions.ts` (linha ~149, bloco `.insert({...})`)

- [ ] **Step 1: Adicionar `me_service_id` no insert de orders**

Localizar em `createOrder` o bloco de insert de pedidos (por volta da linha 149):
```typescript
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        usuario_id: context.userId,
        status: "pendente",
        subtotal,
        frete: shippingValor,
        total,
        endereco: address,
        payment_method: data.payment_method,
        address_id: data.address_id,
        coupon_id: data.coupon_id ?? null,
        desconto,
      })
```

Substituir pelo insert com o novo campo:
```typescript
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        usuario_id: context.userId,
        status: "pendente",
        subtotal,
        frete: shippingValor,
        total,
        endereco: address,
        payment_method: data.payment_method,
        address_id: data.address_id,
        coupon_id: data.coupon_id ?? null,
        desconto,
        me_service_id: shippingOption.me_service_id ?? null,
      })
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/checkout.functions.ts
git commit -m "feat: persist me_service_id on order creation"
```

---

## Task 4: Criar `label.functions.ts` — geração de etiqueta

**Files:**
- Create: `src/lib/label.functions.ts`

- [ ] **Step 1: Criar o arquivo com a server function `generateLabel`**

```typescript
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const ME_BASE = "https://melhorenvio.com.br/api/v2/me";

const ME_FROM = {
  name: "SOLATTO COMERCIO DE CALCADOS ROUPAS E ACESSORIOS LTDA",
  phone: "16999136670",
  email: "solattoecom@gmail.com",
  document: "51987195000146",
  company_document: "51987195000146",
  address: "R ROMUALDO MAGALHAES PIRRO",
  number: "1050",
  district: "Jd do Eden",
  city: "Franca",
  country_id: "BR",
  postal_code: "14402130",
};

type GenerateLabelInput = { order_id: string };

type GenerateLabelResult = { pdf_url: string; codigo_rastreio: string };

export const generateLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GenerateLabelInput) => input)
  .handler(async ({ data, context: _ctx }): Promise<GenerateLabelResult> => {
    const token = process.env["MELHOR_ENVIO_TOKEN"];
    if (!token) throw new Error("MELHOR_ENVIO_TOKEN não configurado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    // Busca pedido com itens
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, me_service_id, usuario_id, endereco, order_items(quantidade)")
      .eq("id", data.order_id)
      .single();

    if (!order) throw new Error("Pedido não encontrado.");
    if (!["pago", "processando"].includes(order.status)) {
      throw new Error("O pedido precisa estar com status 'pago' ou 'processando'.");
    }
    if (!order.me_service_id) {
      throw new Error("Este pedido não possui serviço Melhor Envio associado.");
    }

    // Busca perfil do cliente
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nome, sobrenome, email")
      .eq("id", order.usuario_id)
      .single();

    const endereco = order.endereco as {
      rua: string;
      numero: string;
      complemento?: string;
      bairro: string;
      cidade: string;
      estado: string;
      cep: string;
    };

    const totalItens = (order.order_items as { quantidade: number }[])
      .reduce((soma, i) => soma + i.quantidade, 0);
    const pesoKg = Math.max(0.1, totalItens * 0.9);

    const meHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "solatto/1.0 (solattoecom@gmail.com)",
    };

    // Passo 1: adicionar ao carrinho
    const cartBody = {
      service: order.me_service_id,
      from: ME_FROM,
      to: {
        name: `${profile?.nome ?? ""} ${profile?.sobrenome ?? ""}`.trim() || "Cliente",
        phone: "00000000000",
        email: profile?.email ?? "",
        address: endereco.rua,
        number: endereco.numero,
        complement: endereco.complemento ?? "",
        district: endereco.bairro,
        city: endereco.cidade,
        state_abbr: endereco.estado,
        country_id: "BR",
        postal_code: endereco.cep.replace(/\D/g, ""),
      },
      volumes: [{ height: 15, width: 22, length: 35, weight: pesoKg }],
    };

    const cartRes = await fetch(`${ME_BASE}/cart`, {
      method: "POST",
      headers: meHeaders,
      body: JSON.stringify(cartBody),
      signal: AbortSignal.timeout(15000),
    });
    if (!cartRes.ok) {
      const txt = await cartRes.text();
      throw new Error(`ME Carrinho: ${txt}`);
    }
    const cartData = (await cartRes.json()) as { id: string };
    const meId = cartData.id;

    // Passo 2: checkout do carrinho
    const checkoutRes = await fetch(`${ME_BASE}/shipment/checkout`, {
      method: "POST",
      headers: meHeaders,
      body: JSON.stringify({ orders: [meId] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!checkoutRes.ok) {
      const txt = await checkoutRes.text();
      throw new Error(`ME Checkout: ${txt}`);
    }

    // Passo 3: gerar etiqueta
    const generateRes = await fetch(`${ME_BASE}/shipment/generate`, {
      method: "POST",
      headers: meHeaders,
      body: JSON.stringify({ orders: [meId] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!generateRes.ok) {
      const txt = await generateRes.text();
      throw new Error(`ME Gerar etiqueta: ${txt}`);
    }
    const generateData = (await generateRes.json()) as Record<string, { tracking: string }>;
    const trackingCode = generateData[meId]?.tracking ?? "";

    // Passo 4: obter URL do PDF
    const printRes = await fetch(`${ME_BASE}/shipment/print?orders[]=${meId}`, {
      headers: { ...meHeaders, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!printRes.ok) {
      const txt = await printRes.text();
      throw new Error(`ME Impressão: ${txt}`);
    }
    const printText = await printRes.text();
    let pdfUrl: string;
    try {
      const parsed = JSON.parse(printText) as { url?: string } | string;
      pdfUrl = typeof parsed === "string" ? parsed : (parsed.url ?? printText.trim());
    } catch {
      pdfUrl = printText.trim().replace(/^"|"$/g, "");
    }

    // Atualizar pedido: me_order_id, codigo_rastreio, status = "enviado"
    await supabaseAdmin
      .from("orders")
      .update({
        me_order_id: meId,
        codigo_rastreio: trackingCode || null,
        status: "enviado",
      })
      .eq("id", data.order_id);

    return { pdf_url: pdfUrl, codigo_rastreio: trackingCode };
  });
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/label.functions.ts
git commit -m "feat: add generateLabel server function via Melhor Envio"
```

---

## Task 5: Criar `tracking.functions.ts` — buscar eventos de rastreio

**Files:**
- Create: `src/lib/tracking.functions.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
import { createServerFn } from "@tanstack/react-start";

export type TrackingEvent = {
  descricao: string;
  data: string;
  local?: string;
};

type METrackingEvent = {
  description?: string;
  message?: string;
  created_at?: string;
  location?: string | { city?: string; state?: string };
};

type METrackingItem = {
  events?: METrackingEvent[];
};

type METrackingResponse = Record<string, METrackingItem>;

type GetTrackingInput = { me_order_id: string };

export const getTrackingEvents = createServerFn({ method: "GET" })
  .inputValidator((input: GetTrackingInput) => input)
  .handler(async ({ data }): Promise<TrackingEvent[]> => {
    const token = process.env["MELHOR_ENVIO_TOKEN"];
    if (!token) return [];

    try {
      const res = await fetch(
        `https://melhorenvio.com.br/api/v2/me/shipment/tracking?orders[]=${encodeURIComponent(data.me_order_id)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "User-Agent": "solatto/1.0 (solattoecom@gmail.com)",
          },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!res.ok) return [];

      const responseData = (await res.json()) as METrackingResponse;
      const item = responseData[data.me_order_id];
      if (!item?.events || item.events.length === 0) return [];

      return item.events
        .map((e): TrackingEvent => {
          const descricao = e.description ?? e.message ?? "Evento de rastreio";
          const dataFormatada = e.created_at
            ? new Date(e.created_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";
          let local: string | undefined;
          if (e.location) {
            if (typeof e.location === "string") {
              local = e.location;
            } else if (e.location.city) {
              local = e.location.state
                ? `${e.location.city}/${e.location.state}`
                : e.location.city;
            }
          }
          return { descricao, data: dataFormatada, local };
        })
        .reverse(); // mais recente no topo
    } catch {
      return [];
    }
  });
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tracking.functions.ts
git commit -m "feat: add getTrackingEvents server function"
```

---

## Task 6: Botão "Gerar Etiqueta" no painel admin

**Files:**
- Modify: `src/routes/_authenticated/admin.tsx`

- [ ] **Step 1: Adicionar import de `generateLabel`**

Localizar os imports no topo de `admin.tsx` (por volta da linha 11):
```typescript
import { notificarMudancaStatus } from "@/lib/email.functions";
```

Adicionar logo abaixo:
```typescript
import { generateLabel } from "@/lib/label.functions";
```

- [ ] **Step 2: Adicionar `me_service_id` e `me_order_id` ao tipo `Pedido`**

Localizar o tipo `Pedido` (por volta da linha 59):
```typescript
type Pedido = {
  id: string;
  status: string;
  subtotal: number;
  frete: number;
  total: number;
  coupon_id: string | null;
  payment_method: string | null;
  nota_fiscal: string | null;
  codigo_rastreio: string | null;
  criado_em: string;
  usuario_id: string;
  endereco: Record<string, string>;
  profiles: { nome: string; sobrenome: string; email: string } | null;
  order_items: PedidoItem[];
};
```

Substituir por:
```typescript
type Pedido = {
  id: string;
  status: string;
  subtotal: number;
  frete: number;
  total: number;
  coupon_id: string | null;
  payment_method: string | null;
  nota_fiscal: string | null;
  codigo_rastreio: string | null;
  me_service_id: number | null;
  me_order_id: string | null;
  criado_em: string;
  usuario_id: string;
  endereco: Record<string, string>;
  profiles: { nome: string; sobrenome: string; email: string } | null;
  order_items: PedidoItem[];
};
```

- [ ] **Step 3: Adicionar estados para etiqueta**

Localizar na função `AdminPanel` o bloco de estados (por volta da linha 128):
```typescript
  const [editCupom, setEditCupom] = useState({ expires_at: "", max_uses: "" });
```

Adicionar logo após:
```typescript
  const [labelPorPedido, setLabelPorPedido] = useState<Record<string, { pdf_url: string; codigo_rastreio: string }>>({});
  const [labelErroPorPedido, setLabelErroPorPedido] = useState<Record<string, string>>({});
  const [labelOcupado, setLabelOcupado] = useState<string | null>(null);
```

- [ ] **Step 4: Adicionar função `handleGenerateLabel`**

Localizar a função `virarAdmin` (por volta da linha 270). Adicionar a função antes dela:
```typescript
  async function handleGenerateLabel(pedidoId: string) {
    setLabelOcupado(pedidoId);
    setLabelErroPorPedido((prev) => { const next = { ...prev }; delete next[pedidoId]; return next; });
    try {
      const result = await generateLabel({ data: { order_id: pedidoId } });
      setLabelPorPedido((prev) => ({ ...prev, [pedidoId]: result }));
      await carregar();
    } catch (e) {
      setLabelErroPorPedido((prev) => ({
        ...prev,
        [pedidoId]: e instanceof Error ? e.message : "Erro ao gerar etiqueta.",
      }));
    } finally {
      setLabelOcupado(null);
    }
  }
```

- [ ] **Step 5: Atualizar query para incluir `me_service_id` e `me_order_id`**

Localizar a query de pedidos dentro da função `carregar` (por volta da linha 152):
```typescript
      supabase
        .from("orders")
        .select(
          "id, status, subtotal, frete, total, coupon_id, payment_method, nota_fiscal, codigo_rastreio, criado_em, usuario_id, endereco, profiles(nome, sobrenome, email), order_items(id, quantidade, preco_unitario, subtotal, products(nome, slug, product_images(url)), product_variants(tamanho))",
        )
        .order("criado_em", { ascending: false }),
```

Substituir por:
```typescript
      supabase
        .from("orders")
        .select(
          "id, status, subtotal, frete, total, coupon_id, payment_method, nota_fiscal, codigo_rastreio, me_service_id, me_order_id, criado_em, usuario_id, endereco, profiles(nome, sobrenome, email), order_items(id, quantidade, preco_unitario, subtotal, products(nome, slug, product_images(url)), product_variants(tamanho))",
        )
        .order("criado_em", { ascending: false }),
```

- [ ] **Step 6: Adicionar botão "Gerar Etiqueta" na seção de pedidos expandidos**

Localizar na seção expandida do pedido no admin, após o bloco "Alterar status" (por volta da linha 598, fechamento `</div>` do bloco "Alterar status"):

```typescript
                      {/* Alterar status */}
                      <div>
                        ...
                      </div>
                    </div>
                  )}
```

Adicionar o bloco de etiqueta entre o fechamento de "Alterar status" e o fechamento do `div` de detalhes (`</div></div>`):

```typescript
                      {/* Gerar etiqueta Melhor Envio */}
                      {(p.status === "pago" || p.status === "processando") && p.me_service_id !== null && (
                        <div>
                          <p className="font-semibold mb-2">Etiqueta de envio</p>
                          {labelPorPedido[p.id] ? (
                            <div className="space-y-2">
                              <a
                                href={labelPorPedido[p.id].pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background hover:bg-foreground/85"
                              >
                                Imprimir Etiqueta
                              </a>
                              {labelPorPedido[p.id].codigo_rastreio && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  Rastreio: {labelPorPedido[p.id].codigo_rastreio}
                                </p>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={labelOcupado === p.id}
                              onClick={() => handleGenerateLabel(p.id)}
                              className="cursor-pointer rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
                            >
                              {labelOcupado === p.id ? "Gerando..." : "Gerar Etiqueta"}
                            </button>
                          )}
                          {labelErroPorPedido[p.id] && (
                            <p className="mt-1 text-xs text-destructive">{labelErroPorPedido[p.id]}</p>
                          )}
                        </div>
                      )}
```

- [ ] **Step 7: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/routes/_authenticated/admin.tsx
git commit -m "feat: add generate label button in admin order panel"
```

---

## Task 7: Timeline de rastreio em tempo real em `pedidos.tsx`

**Files:**
- Modify: `src/routes/_authenticated/pedidos.tsx`

- [ ] **Step 1: Adicionar import de `getTrackingEvents` e `TrackingEvent`**

Localizar na linha 7:
```typescript
import { retryPixPayment, getOrderStatus, cancelOrder } from "@/lib/checkout.functions";
```

Adicionar abaixo:
```typescript
import { getTrackingEvents, type TrackingEvent } from "@/lib/tracking.functions";
```

- [ ] **Step 2: Adicionar `me_order_id` ao tipo `Order`**

Localizar o tipo `Order` (por volta da linha 34):
```typescript
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
```

Substituir por:
```typescript
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
  criado_em: string;
  endereco: Record<string, string>;
  coupons: { code: string; type: string; value: number } | null;
  order_items: OrderItem[];
};
```

- [ ] **Step 3: Adicionar estados de tracking**

Localizar na função `PedidosPage` (por volta da linha 115):
```typescript
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);
```

Adicionar logo após:
```typescript
  const [trackingEventsByOrder, setTrackingEventsByOrder] = useState<Record<string, TrackingEvent[]>>({});
  const [trackingLoadingByOrder, setTrackingLoadingByOrder] = useState<Record<string, boolean>>({});
```

- [ ] **Step 4: Adicionar função `handleLoadTracking`**

Localizar a função `handleCancelOrder` (por volta da linha 178). Adicionar antes dela:
```typescript
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
```

- [ ] **Step 5: Atualizar query para incluir `me_order_id`**

Localizar dentro do `useEffect` da query inicial (por volta da linha 122):
```typescript
          id, status, subtotal, frete, total, desconto, payment_method, nota_fiscal, codigo_rastreio, criado_em, endereco,
```

Substituir por:
```typescript
          id, status, subtotal, frete, total, desconto, payment_method, nota_fiscal, codigo_rastreio, me_order_id, criado_em, endereco,
```

- [ ] **Step 6: Chamar `handleLoadTracking` ao expandir pedido com `me_order_id`**

Localizar o botão cabeçalho clicável (por volta da linha 226):
```typescript
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/30"
                >
```

Substituir o `onClick` por:
```typescript
                <button
                  type="button"
                  onClick={() => {
                    const next = isOpen ? null : order.id;
                    setExpanded(next);
                    if (next && order.me_order_id) {
                      void handleLoadTracking(order.id, order.me_order_id);
                    }
                  }}
                  className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/30"
                >
```

- [ ] **Step 7: Substituir a seção de rastreio existente pela lógica condicional**

Localizar a seção de rastreio atual (por volta da linha 427):
```typescript
                    {/* Rastreio */}
                    {order.codigo_rastreio ? (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 font-semibold">
                          <Truck className="size-4" /> Rastreamento
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-mono text-muted-foreground">{order["codigo_rastreio"]}</p>
                          <a
                            href={`https://rastreamento.correios.com.br/app/index.php?objeto=${order["codigo_rastreio"]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background hover:bg-foreground/85"
                          >
                            Correios
                          </a>
                          <a
                            href={`https://www.linketrack.com/trace/${order["codigo_rastreio"]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted"
                          >
                            Linketrack
                          </a>
                        </div>
                      </div>
                    ) : null}
```

Substituir por:
```typescript
                    {/* Rastreio */}
                    {order.me_order_id ? (
                      <div>
                        <p className="mb-3 flex items-center gap-1.5 font-semibold">
                          <Truck className="size-4" /> Rastreamento
                        </p>
                        {trackingLoadingByOrder[order.id] ? (
                          <p className="text-sm text-muted-foreground">Carregando eventos...</p>
                        ) : trackingEventsByOrder[order.id]?.length ? (
                          <ol className="space-y-3">
                            {trackingEventsByOrder[order.id].map((evento, idx) => (
                              <li key={idx} className="flex gap-3">
                                <div className="mt-0.5 flex flex-col items-center">
                                  <div className="size-2.5 rounded-full bg-foreground shrink-0" />
                                  {idx < trackingEventsByOrder[order.id].length - 1 && (
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
                        ) : (
                          <p className="text-sm text-muted-foreground">Nenhum evento de rastreio ainda.</p>
                        )}
                      </div>
                    ) : order.codigo_rastreio ? (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 font-semibold">
                          <Truck className="size-4" /> Rastreamento
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-mono text-muted-foreground">{order["codigo_rastreio"]}</p>
                          <a
                            href={`https://rastreamento.correios.com.br/app/index.php?objeto=${order["codigo_rastreio"]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background hover:bg-foreground/85"
                          >
                            Correios
                          </a>
                          <a
                            href={`https://www.linketrack.com/trace/${order["codigo_rastreio"]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted"
                          >
                            Linketrack
                          </a>
                        </div>
                      </div>
                    ) : null}
```

- [ ] **Step 8: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 9: Commit**

```bash
git add src/routes/_authenticated/pedidos.tsx
git commit -m "feat: add real-time tracking timeline in pedidos"
```

---

## Verificação manual após implementação completa

1. **Checkout com ME:** Crie um pedido como cliente varejo. Confirme que a coluna `me_service_id` na tabela `orders` está preenchida.
2. **Gerar etiqueta:** No painel admin, acesse um pedido com status `pago` e `me_service_id` não nulo. O botão "Gerar Etiqueta" deve aparecer. Clique e confirme que abre link do PDF e preenche o código de rastreio.
3. **Timeline cliente:** Na página `/pedidos`, expanda um pedido com `me_order_id` preenchido. A timeline de eventos deve carregar e exibir em ordem cronológica decrescente.
4. **Fallback:** Pedidos antigos sem `me_order_id` mas com `codigo_rastreio` continuam exibindo links Correios/Linketrack.
5. **Atacado:** Pedidos com `clientTipo === "atacado"` não têm `me_service_id`; o botão não deve aparecer.
