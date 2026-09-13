# Cupons de Desconto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar suporte a cupons de desconto no carrinho, checkout, detalhes do pedido e painel admin da loja Solatto.

**Architecture:** Nova tabela `coupons` no Supabase + coluna `coupon_id`/`desconto` em `orders`. Server function `validateCoupon` valida o código e retorna o desconto; `applyOrderCoupon` incrementa `used_count` ao finalizar o pedido. Componente `CouponInput` é reutilizado no carrinho (sidebar) e no checkout.

**Tech Stack:** TypeScript, React, TanStack Start (`createServerFn`), Supabase (client + admin), Tailwind CSS, lucide-react.

---

## Arquivo Map

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20260913120000_coupons.sql` | Criar (novo) |
| `src/lib/coupon.functions.ts` | Criar (novo) |
| `src/components/CouponInput.tsx` | Criar (novo) |
| `src/routes/index.tsx` | Modificar — integrar CouponInput no carrinho |
| `src/routes/_authenticated/checkout.tsx` | Modificar — integrar CouponInput e recalcular total |
| `src/lib/checkout.functions.ts` | Modificar — receber e salvar cupom no pedido |
| `src/routes/_authenticated/pedidos.tsx` | Modificar — exibir cupom nos detalhes |
| `src/routes/_authenticated/admin.tsx` | Modificar — aba "Cupons" para CRUD |

---

## Task 1: Migration — tabela `coupons` e colunas em `orders`

**Files:**
- Create: `supabase/migrations/20260913120000_coupons.sql`

- [ ] **Step 1: Criar o arquivo de migration**

Conteúdo completo de `supabase/migrations/20260913120000_coupons.sql`:

```sql
CREATE TYPE public.coupon_type AS ENUM ('percent', 'fixed');

CREATE TABLE public.coupons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL,
  type        public.coupon_type NOT NULL,
  value       numeric(10,2) NOT NULL CHECK (value > 0),
  expires_at  timestamptz,
  max_uses    integer,
  used_count  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupons_code_unique UNIQUE (code)
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_id  uuid REFERENCES public.coupons(id),
  ADD COLUMN IF NOT EXISTS desconto   numeric(10,2) NOT NULL DEFAULT 0;

-- RLS: apenas service_role acessa diretamente
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons_service_role" ON public.coupons
  FOR ALL TO service_role USING (true);
```

- [ ] **Step 2: Aplicar a migration localmente**

```bash
cd /c/Users/vande/Usersvandee-commerce
npx supabase db push
```

Esperado: migration aplicada sem erros.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260913120000_coupons.sql
git commit -m "feat: add coupons table and coupon_id/desconto columns to orders"
```

---

## Task 2: Server function `validateCoupon`

**Files:**
- Create: `src/lib/coupon.functions.ts`

- [ ] **Step 1: Criar o arquivo**

Conteúdo completo de `src/lib/coupon.functions.ts`:

```ts
import { createServerFn } from "@tanstack/react-start";

export type DiscountResult = {
  coupon_id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  discount_amount: number;
};

export const validateCoupon = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; subtotal: number }) => input)
  .handler(async ({ data }): Promise<DiscountResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: coupon, error } = await supabaseAdmin
      .from("coupons")
      .select("id, code, type, value, expires_at, max_uses, used_count, active")
      .ilike("code", data.code.trim())
      .single();

    if (error || !coupon) throw new Error("Cupom inválido.");
    if (!coupon.active) throw new Error("Cupom inativo.");
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) throw new Error("Cupom expirado.");
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) throw new Error("Cupom esgotado.");

    const subtotal = Math.max(0, data.subtotal);
    const discount_amount =
      coupon.type === "percent"
        ? subtotal * (coupon.value / 100)
        : Math.min(coupon.value, subtotal);

    return {
      coupon_id: coupon.id,
      code: coupon.code,
      type: coupon.type as "percent" | "fixed",
      value: coupon.value,
      discount_amount: Math.round(discount_amount * 100) / 100,
    };
  });

export const applyOrderCoupon = async (coupon_id: string, order_id: string): Promise<void> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

  await supabaseAdmin.rpc("increment_coupon_used_count", { p_coupon_id: coupon_id });
  await supabaseAdmin.from("orders").update({ coupon_id }).eq("id", order_id);
};
```

- [ ] **Step 2: Criar a função RPC no Supabase para incremento atômico**

Criar `supabase/migrations/20260913120001_coupon_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION public.increment_coupon_used_count(p_coupon_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.coupons
  SET used_count = used_count + 1
  WHERE id = p_coupon_id;
$$;
```

Aplicar:

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/coupon.functions.ts supabase/migrations/20260913120001_coupon_rpc.sql
git commit -m "feat: add validateCoupon and applyOrderCoupon server functions"
```

---

## Task 3: Componente `CouponInput`

**Files:**
- Create: `src/components/CouponInput.tsx`

- [ ] **Step 1: Criar o componente**

Conteúdo completo de `src/components/CouponInput.tsx`:

```tsx
import { useState } from "react";
import { Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateCoupon, type DiscountResult } from "@/lib/coupon.functions";

type Props = {
  subtotal: number;
  onApply: (discount: DiscountResult | null) => void;
};

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CouponInput({ subtotal, onApply }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<DiscountResult | null>(null);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await validateCoupon({ data: { code: code.trim(), subtotal } });
      setApplied(result);
      onApply(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cupom inválido.");
      setApplied(null);
      onApply(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setCode("");
    setApplied(null);
    setError(null);
    onApply(null);
  };

  if (applied) {
    return (
      <div className="mb-4 rounded-lg border border-border p-3">
        <p className="mb-1 flex items-center gap-2 text-sm font-medium">
          <Tag className="size-4" /> Cupom aplicado
        </p>
        <div className="flex items-center justify-between">
          <div>
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
              {applied.code}
            </span>
            <span className="ml-2 text-sm text-green-700 font-medium">
              -{brl(applied.discount_amount)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Remover cupom"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Tag className="size-4" /> Cupom de desconto
      </p>
      <form onSubmit={handleApply} className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Digite o cupom"
          aria-label="Código do cupom"
          className="h-10"
        />
        <Button
          type="submit"
          disabled={loading || !code.trim()}
          className="h-10 cursor-pointer rounded-md bg-foreground px-4 text-background hover:bg-foreground/90"
        >
          {loading ? "..." : "Aplicar"}
        </Button>
      </form>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CouponInput.tsx
git commit -m "feat: add CouponInput component"
```

---

## Task 4: Integrar `CouponInput` no carrinho (sidebar)

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Adicionar import e estado do desconto**

No topo do arquivo `src/routes/index.tsx`, adicionar o import:

```ts
import { CouponInput } from "@/components/CouponInput";
import type { DiscountResult } from "@/lib/coupon.functions";
```

Dentro da função do componente, onde já existe `const [frete, setFrete] = useState<ShippingOption | null>(null);`, adicionar logo abaixo:

```ts
const [desconto, setDesconto] = useState<DiscountResult | null>(null);
```

- [ ] **Step 2: Adicionar `CouponInput` após `ShippingCalculator`**

Localizar o bloco (em torno da linha 820–825):

```tsx
              {cart.items.length > 0 ? (
                <ShippingCalculator
                  itens={cart.items.reduce((sum, item) => sum + item.quantidade, 0)}
                  subtotal={cart.total}
                  onSelect={setFrete}
                />
              ) : null}
```

Substituir por:

```tsx
              {cart.items.length > 0 ? (
                <>
                  <ShippingCalculator
                    itens={cart.items.reduce((sum, item) => sum + item.quantidade, 0)}
                    subtotal={cart.total}
                    onSelect={setFrete}
                  />
                  <CouponInput subtotal={cart.total} onApply={setDesconto} />
                </>
              ) : null}
```

- [ ] **Step 3: Atualizar exibição dos totais**

Localizar o bloco de subtotal/frete/total (linhas 826–844) e substituir pelo seguinte, que inclui linha de desconto:

```tsx
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{Number(cart.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
              {desconto ? (
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cupom ({desconto.code})</span>
                  <span className="text-green-600 font-medium">
                    -{Number(desconto.discount_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              ) : null}
              {frete ? (
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Frete ({frete.nome})</span>
                  <span>
                    {frete.valor === 0
                      ? "Grátis"
                      : Number(frete.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              ) : null}
              <div className="mb-3 mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="text-lg font-semibold">
                  {Number(cart.total - (desconto?.discount_amount ?? 0) + (frete?.valor ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat: integrate CouponInput in cart sidebar"
```

---

## Task 5: Integrar `CouponInput` no checkout e atualizar `createOrder`

**Files:**
- Modify: `src/routes/_authenticated/checkout.tsx`
- Modify: `src/lib/checkout.functions.ts`

- [ ] **Step 1: Adicionar imports e estado no checkout**

Em `src/routes/_authenticated/checkout.tsx`, adicionar os imports:

```ts
import { CouponInput } from "@/components/CouponInput";
import type { DiscountResult } from "@/lib/coupon.functions";
```

Dentro de `CheckoutPage`, logo após `const [frete, setFrete] = useState<...>`:

```ts
const [desconto, setDesconto] = useState<DiscountResult | null>(null);
```

- [ ] **Step 2: Atualizar cálculo do `totalFinal`**

Localizar (linha ~54):

```ts
const totalFinal = total + frete;
```

Substituir por:

```ts
const totalFinal = total - (desconto?.discount_amount ?? 0) + frete;
```

- [ ] **Step 3: Adicionar `CouponInput` na etapa de entrega**

No checkout, a etapa `"entrega"` tem o resumo do pedido. Localizar onde aparece o resumo com subtotal/frete na etapa de entrega (seção de `step === "entrega"`) e adicionar o `CouponInput` antes do resumo de totais:

```tsx
<CouponInput subtotal={total} onApply={setDesconto} />
```

E adicionar linha de desconto no resumo:

```tsx
{desconto ? (
  <p className="text-muted-foreground">
    Cupom ({desconto.code}): -{Number(desconto.discount_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
  </p>
) : null}
```

- [ ] **Step 4: Passar `coupon_id` e `desconto` para `createOrder`**

Em `handlePay`, localizar o objeto passado para `createOrder` e adicionar:

```ts
coupon_id: desconto?.coupon_id ?? null,
desconto: desconto?.discount_amount ?? 0,
```

- [ ] **Step 5: Atualizar `CreateOrderInput` e handler em `checkout.functions.ts`**

Em `src/lib/checkout.functions.ts`, adicionar no tipo `CreateOrderInput`:

```ts
coupon_id?: string | null;
desconto?: number;
```

No handler, antes do insert de `orders`, adicionar as colunas:

```ts
coupon_id: data.coupon_id ?? null,
desconto: data.desconto ?? 0,
```

E após criar o pedido com sucesso (logo após o `await supabaseAdmin.from("order_items").insert(...)`), chamar a função de incremento do cupom:

```ts
if (data.coupon_id) {
  await supabaseAdmin.rpc("increment_coupon_used_count", { p_coupon_id: data.coupon_id });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/_authenticated/checkout.tsx src/lib/checkout.functions.ts
git commit -m "feat: integrate CouponInput in checkout and apply coupon on order creation"
```

---

## Task 6: Exibir cupom nos detalhes do pedido (`pedidos.tsx`)

**Files:**
- Modify: `src/routes/_authenticated/pedidos.tsx`

- [ ] **Step 1: Atualizar o tipo `Order`**

Localizar o tipo `Order` e adicionar os campos:

```ts
coupon_id: string | null;
desconto: number;
coupons: { code: string; type: string; value: number } | null;
```

- [ ] **Step 2: Atualizar a query do Supabase**

Localizar a query `.select(...)` dentro do `useEffect` e adicionar `coupons(code, type, value)` ao select:

```ts
.select(`
  id, status, subtotal, frete, total, desconto, payment_method, nota_fiscal, codigo_rastreio, criado_em, endereco,
  coupons(code, type, value),
  order_items(id, quantidade, preco_unitario, subtotal,
    products(nome, product_images(url)),
    product_variants(tamanho)
  )
`)
```

- [ ] **Step 3: Exibir cupom na seção de totais**

Localizar o bloco de totais expandidos (seção `{/* Totais */}`):

```tsx
<div className="rounded-xl border border-border p-4 space-y-1.5">
  <div className="flex justify-between text-muted-foreground">
    <span>Subtotal</span>
    <span>{brl(order.subtotal)}</span>
  </div>
  <div className="flex justify-between text-muted-foreground">
    <span>Frete</span>
    <span>{order.frete === 0 ? "Grátis" : brl(order.frete)}</span>
  </div>
  <div className="flex justify-between border-t border-border pt-2 font-semibold">
    <span>Total</span>
    <span>{brl(order.total)}</span>
  </div>
</div>
```

Substituir por:

```tsx
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
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authenticated/pedidos.tsx
git commit -m "feat: show applied coupon in order details"
```

---

## Task 7: Painel admin — aba "Cupons"

**Files:**
- Modify: `src/routes/_authenticated/admin.tsx`

- [ ] **Step 1: Adicionar tipo `Cupom` e estados**

Adicionar o tipo após os tipos existentes:

```ts
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
```

Dentro de `AdminPanel`, adicionar os estados:

```ts
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
```

- [ ] **Step 2: Atualizar o estado da aba**

Localizar:

```ts
const [aba, setAba] = useState<"solicitacoes" | "pedidos" | "produtos">("solicitacoes");
```

Substituir por:

```ts
const [aba, setAba] = useState<"solicitacoes" | "pedidos" | "produtos" | "cupons">("solicitacoes");
```

- [ ] **Step 3: Carregar cupons no `useEffect`**

Dentro do `useEffect` que já carrega dados, adicionar a busca de cupons:

```ts
supabase
  .from("coupons")
  .select("id, code, type, value, expires_at, max_uses, used_count, active, criado_em")
  .order("criado_em", { ascending: false })
  .then(({ data }) => setCupons((data as Cupom[]) ?? []));
```

- [ ] **Step 4: Adicionar funções de criar e toggle**

Dentro do componente, adicionar:

```ts
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
```

- [ ] **Step 5: Adicionar aba "Cupons" na lista de tabs**

Localizar o array de tabs:

```ts
[
  ["solicitacoes", `Solicitações${...}`],
  ["pedidos", `Pedidos${...}`],
  ["produtos", "Produtos"],
] as const
```

Substituir por:

```ts
[
  ["solicitacoes", `Solicitações${pendentes.length ? ` (${pendentes.length})` : ""}`],
  ["pedidos", `Pedidos${pedidos.length ? ` (${pedidos.length})` : ""}`],
  ["produtos", "Produtos"],
  ["cupons", "Cupons"],
] as const
```

- [ ] **Step 6: Adicionar seção de cupons no JSX**

Após o bloco `} : aba === "produtos" ? ( ... ) : null`, adicionar:

```tsx
) : aba === "cupons" ? (
  <section className="space-y-6">
    {/* Formulário de criação */}
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

    {/* Listagem */}
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
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/_authenticated/admin.tsx
git commit -m "feat: add coupon management tab in admin panel"
```

---

## Task 8: Verificação final

- [ ] **Step 1: Build sem erros de TypeScript**

```bash
cd /c/Users/vande/Usersvandee-commerce
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 2: Testar fluxo no browser**

1. Abrir a loja → adicionar item ao carrinho → calcular frete → digitar cupom inválido → verificar mensagem de erro
2. Digitar cupom válido → verificar desconto exibido em verde no total
3. Ir para checkout → verificar cupom disponível na etapa de entrega
4. Finalizar pedido → verificar pedido em "Meus Pedidos" com cupom exibido
5. Painel admin → aba "Cupons" → criar cupom → verificar na listagem → desativar

- [ ] **Step 3: Commit final se necessário**

```bash
git add -A
git commit -m "chore: final adjustments for coupon feature"
```
