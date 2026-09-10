# AbacatePay + Checkout + Meus Pedidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar fluxo completo de compra: checkout em 3 etapas (endereço, frete, pagamento via AbacatePay), aba "Meus Pedidos" no perfil e campo NF-e no admin.

**Architecture:** Server functions TanStack para criar cobranças AbacatePay e expor status de pedidos. Rota de API pública `/api/webhook/abacatepay` recebe confirmações e atualiza banco + estoque + envia e-mail. Frontend em rotas autenticadas `/checkout` e `/pedidos`.

**Tech Stack:** TanStack Router + React Start, Supabase (external.ts/external.server.ts), AbacatePay REST API, Gmail SMTP (Nodemailer), Tailwind + shadcn/ui.

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `supabase/migrations/20260910040000_checkout.sql` | Criar | Tabela `addresses` + colunas em `orders` |
| `src/hooks/useAddresses.ts` | Criar | CRUD de endereços do usuário |
| `src/lib/checkout.functions.ts` | Criar | `createOrder`, `getOrderStatus` server functions |
| `src/routes/api/webhook.abacatepay.ts` | Criar | Endpoint público para webhook AbacatePay |
| `src/routes/_authenticated/checkout.tsx` | Criar | Página checkout 3 etapas |
| `src/routes/_authenticated/pedidos.tsx` | Criar | Aba Meus Pedidos |
| `src/routes/_authenticated/admin.tsx` | Modificar | Campo NF-e no painel admin |
| `src/routes/index.tsx` | Modificar | Link "Meus Pedidos" no menu + reverter traduzErro |

---

## Task 1: Migração do Banco

**Files:**
- Create: `supabase/migrations/20260910040000_checkout.sql`

- [ ] **Step 1: Criar arquivo de migração**

```sql
-- supabase/migrations/20260910040000_checkout.sql

-- Tabela de endereços
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cep text NOT NULL,
  rua text NOT NULL,
  numero text NOT NULL,
  complemento text,
  bairro text NOT NULL,
  cidade text NOT NULL,
  estado char(2) NOT NULL,
  padrao boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addresses_own" ON public.addresses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Colunas novas em orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('pix', 'cartao')),
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES public.addresses(id),
  ADD COLUMN IF NOT EXISTS nota_fiscal text;
```

- [ ] **Step 2: Aplicar no Supabase**

Acesse o SQL Editor em `https://supabase.com/dashboard/project/libqhyxxkpjvtuzpdsnb/sql` e execute o conteúdo do arquivo acima.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260910040000_checkout.sql
git commit -m "feat: migration addresses e colunas de pagamento em orders"
```

---

## Task 2: Hook `useAddresses`

**Files:**
- Create: `src/hooks/useAddresses.ts`

- [ ] **Step 1: Criar hook**

```ts
// src/hooks/useAddresses.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/external";

export type Address = {
  id: string;
  user_id: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  padrao: boolean;
  criado_em: string;
};

export type NewAddress = Omit<Address, "id" | "user_id" | "criado_em">;

export function useAddresses(userId: string | null) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) { setAddresses([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("addresses")
      .select("*")
      .order("padrao", { ascending: false })
      .order("criado_em", { ascending: true });
    setAddresses((data as Address[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const addAddress = useCallback(async (addr: NewAddress) => {
    if (!userId) return;
    if (addr.padrao) {
      await supabase.from("addresses").update({ padrao: false }).eq("user_id", userId);
    }
    await supabase.from("addresses").insert({ ...addr, user_id: userId });
    await refresh();
  }, [userId, refresh]);

  const setDefault = useCallback(async (id: string) => {
    if (!userId) return;
    await supabase.from("addresses").update({ padrao: false }).eq("user_id", userId);
    await supabase.from("addresses").update({ padrao: true }).eq("id", id);
    await refresh();
  }, [userId, refresh]);

  const removeAddress = useCallback(async (id: string) => {
    await supabase.from("addresses").delete().eq("id", id);
    await refresh();
  }, [refresh]);

  return { addresses, loading, refresh, addAddress, setDefault, removeAddress };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAddresses.ts
git commit -m "feat: hook useAddresses para CRUD de endereços"
```

---

## Task 3: Server Functions de Checkout

**Files:**
- Create: `src/lib/checkout.functions.ts`

> **Importante:** Verifique os endpoints exatos da AbacatePay em `https://docs.abacatepay.com`. Os campos abaixo seguem o padrão documentado publicamente mas podem variar conforme versão da API.

- [ ] **Step 1: Criar arquivo**

```ts
// src/lib/checkout.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const ABACATEPAY_URL = "https://api.abacatepay.com/v1";

type OrderItem = {
  produto_id: string;
  variacao_id: string | null;
  nome: string;
  quantidade: number;
  preco_unitario: number;
};

type CreateOrderInput = {
  address_id: string;
  shipping_option_id: string;
  shipping_valor: number;
  shipping_nome: string;
  payment_method: "pix" | "cartao";
  items: OrderItem[];
  subtotal: number;
  total: number;
  // Cartão (opcional)
  card_number?: string;
  card_holder?: string;
  card_expiry?: string;
  card_cvv?: string;
};

export type CreateOrderResult = {
  order_id: string;
  payment_method: "pix" | "cartao";
  pix_qr?: string;
  pix_qr_code?: string;
  pix_expiration?: string;
  status: string;
};

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateOrderInput) => input)
  .handler(async ({ data, context }): Promise<CreateOrderResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");
    const apiKey = process.env["ABACATEPAY_API_KEY"];
    if (!apiKey) throw new Error("ABACATEPAY_API_KEY não configurada.");

    // 1. Verificar estoque
    for (const item of data.items) {
      if (item.variacao_id) {
        const { data: variacao } = await supabaseAdmin
          .from("product_variants")
          .select("estoque")
          .eq("id", item.variacao_id)
          .single();
        if (!variacao || variacao.estoque < item.quantidade) {
          throw new Error(`Estoque insuficiente para o produto "${item.nome}".`);
        }
      }
    }

    // 2. Buscar endereço
    const { data: address } = await supabaseAdmin
      .from("addresses")
      .select("*")
      .eq("id", data.address_id)
      .eq("user_id", context.userId)
      .single();
    if (!address) throw new Error("Endereço não encontrado.");

    // 3. Buscar perfil do usuário
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nome, sobrenome, email")
      .eq("id", context.userId)
      .single();
    if (!profile) throw new Error("Perfil não encontrado.");

    // 4. Criar pedido no banco
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        usuario_id: context.userId,
        status: "pendente",
        subtotal: data.subtotal,
        frete: data.shipping_valor,
        total: data.total,
        endereco: address,
        payment_method: data.payment_method,
        address_id: data.address_id,
      })
      .select("id")
      .single();
    if (orderError || !order) throw new Error("Erro ao criar pedido.");

    // 5. Inserir itens do pedido
    await supabaseAdmin.from("order_items").insert(
      data.items.map((item) => ({
        pedido_id: order.id,
        produto_id: item.produto_id,
        variacao_id: item.variacao_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        subtotal: item.preco_unitario * item.quantidade,
      }))
    );

    // 6. Chamar AbacatePay
    const methods = data.payment_method === "pix" ? ["PIX"] : ["CREDIT_CARD"];

    const abacateBody: Record<string, unknown> = {
      frequency: "ONE_TIME",
      methods,
      returnUrl: `${process.env["VITE_SUPABASE_URL"] ? "https://e-commerce-rnfpag7k6-solattoecom-1856.vercel.app" : "http://localhost:3000"}/pedidos`,
      completionUrl: `${process.env["VITE_SUPABASE_URL"] ? "https://e-commerce-rnfpag7k6-solattoecom-1856.vercel.app" : "http://localhost:3000"}/pedidos`,
      products: data.items.map((item) => ({
        externalId: item.produto_id,
        name: item.nome,
        description: item.nome,
        quantity: item.quantidade,
        price: Math.round(item.preco_unitario * 100),
      })),
      customer: {
        name: `${profile.nome} ${profile.sobrenome}`.trim(),
        email: profile.email,
      },
      metadata: { order_id: order.id },
    };

    if (data.payment_method === "cartao") {
      abacateBody["card"] = {
        number: data.card_number,
        holderName: data.card_holder,
        expiry: data.card_expiry,
        cvv: data.card_cvv,
      };
    }

    const abacateRes = await fetch(`${ABACATEPAY_URL}/billing/create`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(abacateBody),
    });

    if (!abacateRes.ok) {
      const err = await abacateRes.text();
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(`AbacatePay: ${err}`);
    }

    const abacateData = await abacateRes.json() as {
      data: {
        id: string;
        status: string;
        pixQr?: string;
        pixQrCode?: string;
        expiresAt?: string;
      };
    };

    // 7. Salvar payment_id no pedido
    await supabaseAdmin
      .from("orders")
      .update({ payment_id: abacateData.data.id })
      .eq("id", order.id);

    return {
      order_id: order.id,
      payment_method: data.payment_method,
      pix_qr: abacateData.data.pixQr,
      pix_qr_code: abacateData.data.pixQrCode,
      pix_expiration: abacateData.data.expiresAt,
      status: abacateData.data.status,
    };
  });

export const getOrderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_id")
      .eq("id", data.order_id)
      .eq("usuario_id", context.userId)
      .single();

    if (!order) throw new Error("Pedido não encontrado.");
    return { status: order.status, payment_id: order.payment_id };
  });
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/checkout.functions.ts
git commit -m "feat: server functions createOrder e getOrderStatus"
```

---

## Task 4: Webhook AbacatePay

**Files:**
- Create: `src/routes/api/webhook.abacatepay.ts`

- [ ] **Step 1: Criar rota de API**

```ts
// src/routes/api/webhook.abacatepay.ts
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createTransport } from "nodemailer";

export const APIRoute = createAPIFileRoute("/api/webhook/abacatepay")({
  POST: async ({ request }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

      const body = await request.json() as {
        event: string;
        data: {
          billing: {
            id: string;
            status: string;
            metadata?: { order_id?: string };
          };
        };
      };

      // Só processa eventos de pagamento confirmado
      if (body.event !== "billing.paid" && body.data?.billing?.status !== "PAID") {
        return new Response("ignored", { status: 200 });
      }

      const paymentId = body.data.billing.id;
      const orderId = body.data.billing.metadata?.order_id;

      // Buscar pedido pelo payment_id ou metadata
      const query = supabaseAdmin
        .from("orders")
        .select("id, usuario_id, total, status")
        .eq("status", "pendente");

      const { data: order } = orderId
        ? await query.eq("id", orderId).single()
        : await query.eq("payment_id", paymentId).single();

      if (!order) return new Response("order not found", { status: 404 });
      if (order.status === "pago") return new Response("already paid", { status: 200 });

      // 1. Atualizar status do pedido
      await supabaseAdmin
        .from("orders")
        .update({ status: "pago" })
        .eq("id", order.id);

      // 2. Decrementar estoque
      const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("variacao_id, quantidade")
        .eq("pedido_id", order.id);

      for (const item of items ?? []) {
        if (!item.variacao_id) continue;
        await supabaseAdmin.rpc("decrement_stock", {
          p_variacao_id: item.variacao_id,
          p_quantidade: item.quantidade,
        });
      }

      // 3. Buscar perfil para e-mail
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("nome, email")
        .eq("id", order.usuario_id)
        .single();

      if (profile?.email) {
        const transporter = createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: process.env["GMAIL_USER"],
            pass: process.env["GMAIL_APP_PASSWORD"],
          },
        });

        await transporter.sendMail({
          from: `"Solatto" <${process.env["GMAIL_USER"]}>`,
          to: profile.email,
          subject: "Pedido confirmado — Solatto",
          html: `
            <h2>Olá, ${profile.nome}!</h2>
            <p>Seu pagamento foi confirmado e seu pedido está sendo preparado.</p>
            <p><strong>Número do pedido:</strong> ${order.id.slice(0, 8).toUpperCase()}</p>
            <p><strong>Total:</strong> R$ ${order.total.toFixed(2).replace(".", ",")}</p>
            <p>Acompanhe o status em <a href="https://e-commerce-rnfpag7k6-solattoecom-1856.vercel.app/pedidos">Meus Pedidos</a>.</p>
            <p>Obrigado pela compra!</p>
          `,
        });
      }

      return new Response("ok", { status: 200 });
    } catch (err) {
      console.error("[webhook] erro:", err);
      return new Response("error", { status: 500 });
    }
  },
});
```

- [ ] **Step 2: Adicionar função SQL `decrement_stock`**

Execute no SQL Editor do Supabase:

```sql
CREATE OR REPLACE FUNCTION public.decrement_stock(p_variacao_id uuid, p_quantidade int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.product_variants
  SET estoque = GREATEST(0, estoque - p_quantidade)
  WHERE id = p_variacao_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.decrement_stock(uuid, int) TO service_role;
```

- [ ] **Step 3: Instalar nodemailer**

```bash
cd C:/Users/vande/Usersvandee-commerce
bun add nodemailer
bun add -D @types/nodemailer
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/webhook.abacatepay.ts
git commit -m "feat: webhook AbacatePay — atualiza pedido, estoque e envia e-mail"
```

---

## Task 5: Página de Checkout

**Files:**
- Create: `src/routes/_authenticated/checkout.tsx`

- [ ] **Step 1: Criar rota de checkout**

```tsx
// src/routes/_authenticated/checkout.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CreditCard, MapPin, QrCode, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useAddresses, type NewAddress } from "@/hooks/useAddresses";
import { quoteShipping, type ShippingOption } from "@/lib/shipping.functions";
import { createOrder, getOrderStatus } from "@/lib/checkout.functions";

export const Route = createFileRoute("/_authenticated/checkout")({
  component: CheckoutPage,
});

type Step = "endereco" | "entrega" | "pagamento" | "sucesso";

function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, total, refresh: refreshCart } = useCart(user?.id ?? null);
  const { addresses, loading: addrLoading, addAddress } = useAddresses(user?.id ?? null);

  const [step, setStep] = useState<Step>("endereco");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [newAddr, setNewAddr] = useState<Partial<NewAddress>>({ padrao: false });
  const [cepLoading, setCepLoading] = useState(false);

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cartao">("pix");
  const [card, setCard] = useState({ number: "", holder: "", expiry: "", cvv: "" });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;
  const itemCount = items.reduce((n, i) => n + i.quantidade, 0);
  const frete = selectedShipping?.valor ?? 0;
  const totalFinal = total + frete;

  // Buscar CEP
  const handleCepBlur = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json() as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean };
      if (!data.erro) {
        setNewAddr((prev) => ({
          ...prev,
          cep: digits,
          rua: data.logradouro ?? "",
          bairro: data.bairro ?? "",
          cidade: data.localidade ?? "",
          estado: data.uf ?? "",
        }));
      }
    } finally {
      setCepLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    const addr = newAddr as NewAddress;
    if (!addr.cep || !addr.rua || !addr.numero || !addr.bairro || !addr.cidade || !addr.estado) {
      setErro("Preencha todos os campos obrigatórios do endereço.");
      return;
    }
    await addAddress(addr);
    setShowNewAddr(false);
    setNewAddr({ padrao: false });
    setErro(null);
  };

  const handleGoToShipping = async () => {
    if (!selectedAddressId || !selectedAddress) { setErro("Selecione um endereço."); return; }
    setErro(null);
    setShippingLoading(true);
    try {
      const quote = await quoteShipping({ data: { cep: selectedAddress.cep, itens: itemCount, subtotal: total } });
      setShippingOptions(quote.opcoes);
      setSelectedShipping(quote.opcoes[0] ?? null);
      setStep("entrega");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao calcular frete.");
    } finally {
      setShippingLoading(false);
    }
  };

  const handleGoToPayment = () => {
    if (!selectedShipping) { setErro("Selecione uma opção de entrega."); return; }
    setErro(null);
    setStep("pagamento");
  };

  const handlePay = async () => {
    if (!selectedAddressId || !selectedShipping) return;
    setBusy(true);
    setErro(null);
    try {
      const result = await createOrder({
        data: {
          address_id: selectedAddressId,
          shipping_option_id: selectedShipping.id,
          shipping_valor: selectedShipping.valor,
          shipping_nome: selectedShipping.nome,
          payment_method: paymentMethod,
          items: items.map((item) => ({
            produto_id: item.produto_id,
            variacao_id: item.variacao_id,
            nome: item.products?.nome ?? "",
            quantidade: item.quantidade,
            preco_unitario: item.products?.product_prices?.[0]?.preco ?? 0,
          })),
          subtotal: total,
          total: totalFinal,
          ...(paymentMethod === "cartao" && {
            card_number: card.number,
            card_holder: card.holder,
            card_expiry: card.expiry,
            card_cvv: card.cvv,
          }),
        },
      });

      setOrderId(result.order_id);

      if (paymentMethod === "pix") {
        setPixQr(result.pix_qr ?? null);
        setPixQrCode(result.pix_qr_code ?? null);
        // Polling a cada 5s
        const interval = setInterval(async () => {
          const s = await getOrderStatus({ data: { order_id: result.order_id } });
          if (s.status === "pago") {
            clearInterval(interval);
            await refreshCart();
            setStep("sucesso");
          }
        }, 5000);
      } else {
        await refreshCart();
        setStep("sucesso");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao processar pagamento.");
    } finally {
      setBusy(false);
    }
  };

  const steps: { id: Step; label: string }[] = [
    { id: "endereco", label: "Endereço" },
    { id: "entrega", label: "Entrega" },
    { id: "pagamento", label: "Pagamento" },
  ];
  const stepIndex = steps.findIndex((s) => s.id === step);

  if (step === "sucesso") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-green-100">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-semibold">Pedido confirmado!</h1>
        <p className="text-sm text-muted-foreground">
          Número: <span className="font-mono font-medium">{orderId?.slice(0, 8).toUpperCase()}</span>
        </p>
        <Button onClick={() => navigate({ to: "/pedidos" })}>Ver meus pedidos</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Barra de progresso */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center gap-2">
            <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-medium ${i <= stepIndex ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
              {i < stepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-sm ${i <= stepIndex ? "font-medium" : "text-muted-foreground"}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`h-px flex-1 ${i < stepIndex ? "bg-foreground" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {erro && <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{erro}</p>}

      {/* Resumo do pedido */}
      <div className="mb-6 rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium">{itemCount} {itemCount === 1 ? "item" : "itens"} — Subtotal: R$ {total.toFixed(2).replace(".", ",")}</p>
        {selectedShipping && <p className="text-muted-foreground">Frete: R$ {frete.toFixed(2).replace(".", ",")} — Total: R$ {totalFinal.toFixed(2).replace(".", ",")}</p>}
      </div>

      {/* Etapa 1: Endereço */}
      {step === "endereco" && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5" /> Endereço de entrega</h2>
          {addrLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <button key={addr.id} type="button" onClick={() => setSelectedAddressId(addr.id)}
                  className={`w-full rounded-lg border p-4 text-left text-sm transition-colors ${selectedAddressId === addr.id ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"}`}>
                  <p className="font-medium">{addr.rua}, {addr.numero}{addr.complemento ? `, ${addr.complemento}` : ""}</p>
                  <p className="text-muted-foreground">{addr.bairro} — {addr.cidade}/{addr.estado} — CEP {addr.cep.slice(0, 5)}-{addr.cep.slice(5)}</p>
                  {addr.padrao && <span className="text-xs text-muted-foreground">Padrão</span>}
                </button>
              ))}
            </div>
          )}

          {showNewAddr ? (
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-medium">Novo endereço</h3>
              <div className="grid gap-2">
                <Label htmlFor="cep">CEP *</Label>
                <Input id="cep" placeholder="00000-000" value={newAddr.cep ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, cep: e.target.value }))} onBlur={(e) => handleCepBlur(e.target.value)} disabled={cepLoading} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 grid gap-2">
                  <Label htmlFor="rua">Rua *</Label>
                  <Input id="rua" value={newAddr.rua ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, rua: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="numero">Número *</Label>
                  <Input id="numero" value={newAddr.numero ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, numero: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input id="complemento" value={newAddr.complemento ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, complemento: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bairro">Bairro *</Label>
                  <Input id="bairro" value={newAddr.bairro ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, bairro: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input id="cidade" value={newAddr.cidade ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, cidade: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="estado">Estado *</Label>
                  <Input id="estado" maxLength={2} value={newAddr.estado ?? ""} onChange={(e) => setNewAddr((p) => ({ ...p, estado: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveAddress}>Salvar endereço</Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowNewAddr(false); setErro(null); }}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowNewAddr(true)}>+ Adicionar endereço</Button>
          )}

          <Button className="w-full" disabled={!selectedAddressId || shippingLoading} onClick={handleGoToShipping}>
            {shippingLoading ? "Calculando frete..." : <><span>Continuar</span><ArrowRight className="ml-2 h-4 w-4" /></>}
          </Button>
        </div>
      )}

      {/* Etapa 2: Entrega */}
      {step === "entrega" && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Truck className="h-5 w-5" /> Opção de entrega</h2>
          <div className="space-y-2">
            {shippingOptions.map((opt) => (
              <button key={opt.id} type="button" onClick={() => setSelectedShipping(opt)}
                className={`w-full rounded-lg border p-4 text-left text-sm transition-colors ${selectedShipping?.id === opt.id ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{opt.nome}</p>
                    <p className="text-muted-foreground">{opt.prazo}</p>
                  </div>
                  <p className="font-semibold">{opt.valor === 0 ? "Grátis" : `R$ ${opt.valor.toFixed(2).replace(".", ",")}`}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("endereco")}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
            <Button className="flex-1" disabled={!selectedShipping} onClick={handleGoToPayment}>Continuar <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Etapa 3: Pagamento */}
      {step === "pagamento" && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><CreditCard className="h-5 w-5" /> Pagamento</h2>
          <div className="flex gap-2">
            {(["pix", "cartao"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                className={`flex-1 rounded-lg border p-3 text-sm font-medium transition-colors ${paymentMethod === m ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"}`}>
                {m === "pix" ? "Pix" : "Cartão de crédito"}
              </button>
            ))}
          </div>

          {paymentMethod === "pix" && (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><QrCode className="h-4 w-4" /><span>QR Code gerado ao confirmar</span></div>
              {pixQr && (
                <div className="mt-3 space-y-2">
                  {pixQrCode && <img src={pixQrCode} alt="QR Code Pix" className="mx-auto h-48 w-48" />}
                  <p className="break-all font-mono text-xs">{pixQr}</p>
                  <p className="text-center text-xs text-muted-foreground">Aguardando confirmação do pagamento...</p>
                </div>
              )}
            </div>
          )}

          {paymentMethod === "cartao" && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="card_number">Número do cartão</Label>
                <Input id="card_number" placeholder="0000 0000 0000 0000" maxLength={19} value={card.number} onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="card_holder">Nome no cartão</Label>
                <Input id="card_holder" placeholder="NOME SOBRENOME" value={card.holder} onChange={(e) => setCard((c) => ({ ...c, holder: e.target.value.toUpperCase() }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="card_expiry">Validade</Label>
                  <Input id="card_expiry" placeholder="MM/AA" maxLength={5} value={card.expiry} onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="card_cvv">CVV</Label>
                  <Input id="card_cvv" placeholder="000" maxLength={4} value={card.cvv} onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("entrega")}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
            <Button className="flex-1" disabled={busy} onClick={handlePay}>
              {busy ? "Processando..." : `Pagar R$ ${totalFinal.toFixed(2).replace(".", ",")}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/_authenticated/checkout.tsx
git commit -m "feat: página de checkout em 3 etapas"
```

---

## Task 6: Meus Pedidos

**Files:**
- Create: `src/routes/_authenticated/pedidos.tsx`

- [ ] **Step 1: Criar rota**

```tsx
// src/routes/_authenticated/pedidos.tsx
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
          id, status, subtotal, frete, total, payment_method, nota_fiscal, criado_em, endereco,
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
                    {/* Itens */}
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

                    {/* Endereço */}
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="font-medium mb-1">Endereço de entrega</p>
                      <p className="text-muted-foreground">{order.endereco.rua}, {order.endereco.numero}{order.endereco.complemento ? `, ${order.endereco.complemento}` : ""}</p>
                      <p className="text-muted-foreground">{order.endereco.bairro} — {order.endereco.cidade}/{order.endereco.estado} — CEP {order.endereco.cep?.slice(0, 5)}-{order.endereco.cep?.slice(5)}</p>
                    </div>

                    {/* NF-e */}
                    {order.nota_fiscal && (
                      <p className="text-muted-foreground">NF-e: <span className="font-mono font-medium">{order.nota_fiscal}</span></p>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/_authenticated/pedidos.tsx
git commit -m "feat: página Meus Pedidos"
```

---

## Task 7: Links no Menu + Campo NF-e no Admin

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/_authenticated/admin.tsx`

- [ ] **Step 1: Adicionar link "Meus Pedidos" no menu de perfil de `index.tsx`**

Procure o bloco do menu de usuário (onde estão as opções "Perfil" e "Sair") e adicione o link antes de "Sair":

```tsx
// Adicionar import no topo
import { Link } from "@tanstack/react-router";

// No menu dropdown do usuário, adicionar:
<Link
  to="/pedidos"
  className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
  onClick={() => setMenuOpen(false)}
>
  Meus Pedidos
</Link>
```

Também reverta a função `traduzErro` para a mensagem original:

```tsx
return "Não foi possível concluir. Tente novamente.";
```

- [ ] **Step 2: Adicionar campo NF-e no painel admin**

Em `src/routes/_authenticated/admin.tsx`, no formulário de atualização de status do pedido, adicionar campo de NF-e ao atualizar para "enviado":

Procure onde o admin atualiza o status do pedido e adicione:

```tsx
// Estado local para nf-e
const [nfePorPedido, setNfePorPedido] = useState<Record<string, string>>({});

// Ao salvar status "enviado", incluir nota_fiscal:
await supabase
  .from("orders")
  .update({
    status: novoStatus,
    ...(novoStatus === "enviado" && nfePorPedido[pedidoId]
      ? { nota_fiscal: nfePorPedido[pedidoId] }
      : {}),
  })
  .eq("id", pedidoId);

// Campo NF-e visível apenas ao selecionar "enviado":
{novoStatus === "enviado" && (
  <div className="mt-2 grid gap-1">
    <Label htmlFor={`nfe-${pedidoId}`}>Nota Fiscal (NF-e)</Label>
    <Input
      id={`nfe-${pedidoId}`}
      placeholder="Número da NF-e"
      value={nfePorPedido[pedidoId] ?? ""}
      onChange={(e) => setNfePorPedido((prev) => ({ ...prev, [pedidoId]: e.target.value }))}
    />
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/index.tsx src/routes/_authenticated/admin.tsx
git commit -m "feat: link Meus Pedidos no menu e campo NF-e no admin"
```

---

## Task 8: Variáveis de Ambiente + Deploy

- [ ] **Step 1: Adicionar no Vercel**

Em **Vercel → Settings → Environment Variables**, adicionar:

| Variável | Valor |
|----------|-------|
| `ABACATEPAY_API_KEY` | Chave da API do AbacatePay (painel AbacatePay → Configurações → API) |
| `GMAIL_USER` | `solattoecom@gmail.com` |
| `GMAIL_APP_PASSWORD` | Senha de app do Gmail já configurada |
| `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` | Service role key do Supabase (`libqhyxxkpjvtuzpdsnb`) |

> Nota: `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` é o nome usado pelo `external.server.ts` do Lovable. Verifique se essa variável já está configurada; se o Vercel tiver `SUPABASE_SERVICE_ROLE_KEY` mas não `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`, adicione a nova com o mesmo valor.

- [ ] **Step 2: Configurar URL do webhook no AbacatePay**

No painel AbacatePay → Webhooks, adicionar a URL:
```
https://e-commerce-rnfpag7k6-solattoecom-1856.vercel.app/api/webhook/abacatepay
```

- [ ] **Step 3: Push + Redeploy**

```bash
git push origin main
```

Aguardar deploy automático na Vercel.

- [ ] **Step 4: Testar fluxo completo**

1. Criar conta e fazer login
2. Adicionar produto ao carrinho
3. Acessar `/checkout`
4. Selecionar/criar endereço → avançar
5. Selecionar frete → avançar
6. Selecionar Pix → pagar → verificar QR code
7. Confirmar pagamento (via AbacatePay sandbox se disponível)
8. Verificar que pedido aparece em `/pedidos` com status "pago"
9. Admin: abrir pedido, selecionar "enviado", inserir NF-e e salvar
10. Cliente: verificar NF-e aparece em "Meus Pedidos"
