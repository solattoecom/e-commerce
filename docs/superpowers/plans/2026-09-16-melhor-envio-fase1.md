# Melhor Envio — Fase 1: Cotação + Tracking

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o cálculo de frete estimado pela API real do Melhor Envio para clientes varejo/dropshipping, e atualizar o cron de rastreio para usar a API unificada do Melhor Envio com fallback para Correios.

**Architecture:** `quoteShipping` vira um `createServerFn` (POST) do TanStack Start, mantendo o mesmo retorno `ShippingQuote`. Clientes varejo/dropshipping recebem cotações reais; atacado mantém tabela regional. O `tracking-cron.ts` passa a consultar a API de rastreio do Melhor Envio, com fallback para a API dos Correios.

**Tech Stack:** TanStack Start `createServerFn`, Melhor Envio REST API v2, ViaCEP, TypeScript

---

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/lib/shipping.functions.ts` | Reescrever como `createServerFn` |
| `src/lib/tracking-cron.ts` | Substituir `isEntregue` para usar Melhor Envio + fallback Correios |
| `src/components/ShippingCalculator.tsx` | Atualizar chamada para `{ data: { ... } }` |
| `src/routes/produto.$slug.tsx` | Atualizar 2 chamadas para `{ data: { ... } }` |
| `src/routes/_authenticated/checkout.tsx` | Atualizar chamada + buscar e passar `clientTipo` |
| `src/lib/checkout.functions.ts` | Atualizar chamada + passar `clientTipo` já disponível |

---

## Task 1: Reescrever `shipping.functions.ts` como `createServerFn`

**Files:**
- Modify: `src/lib/shipping.functions.ts`

- [ ] **Substituir o conteúdo completo do arquivo:**

```typescript
import { createServerFn } from "@tanstack/react-start";

export type ShippingOption = {
  id: string;
  nome: string;
  prazo: string;
  valor: number;
};

export type ShippingQuote = {
  cep: string;
  cidade: string;
  uf: string;
  bairro: string;
  logradouro: string;
  opcoes: ShippingOption[];
};

type QuoteInput = {
  cep: string;
  itens: number;
  subtotal: number;
  clientTipo?: "varejo" | "atacado" | "dropshipping";
};

// ── tabela regional (atacado e fallback) ──────────────────────────────────────

const regiao: Record<string, "SE" | "S" | "CO" | "NE" | "N"> = {
  SP: "SE", RJ: "SE", MG: "SE", ES: "SE",
  PR: "S",  SC: "S",  RS: "S",
  DF: "CO", GO: "CO", MT: "CO", MS: "CO",
  BA: "NE", SE: "NE", AL: "NE", PE: "NE", PB: "NE",
  RN: "NE", CE: "NE", PI: "NE", MA: "NE",
  AM: "N",  PA: "N",  AC: "N",  RO: "N",
  RR: "N",  AP: "N",  TO: "N",
};

const tabela: Record<string, { base: number; prazo: number; extraKg: number }> = {
  SE: { base: 19.9,  prazo: 3,  extraKg: 14 },
  S:  { base: 24.9,  prazo: 4,  extraKg: 17 },
  CO: { base: 29.9,  prazo: 6,  extraKg: 20 },
  NE: { base: 34.9,  prazo: 8,  extraKg: 23 },
  N:  { base: 39.9,  prazo: 10, extraKg: 26 },
};

async function cotarPorTabela(
  cep: string,
  itens: number,
  subtotal: number,
): Promise<ShippingQuote> {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!res.ok) throw new Error("Não foi possível consultar o CEP agora.");
  const endereco = (await res.json()) as {
    erro?: boolean | string;
    localidade?: string;
    uf?: string;
    bairro?: string;
    logradouro?: string;
  };
  if (endereco.erro || !endereco.uf) throw new Error("CEP não encontrado.");

  const uf = endereco.uf;
  const faixa = tabela[regiao[uf] ?? "SE"]!;
  const pesoKg = itens * 0.9;
  const extraKg = Math.max(0, pesoKg - 1);
  const extra = extraKg * faixa.extraKg;
  const gratis = subtotal >= 399.9;

  return {
    cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
    cidade: endereco.localidade ?? "",
    uf,
    bairro: endereco.bairro ?? "",
    logradouro: endereco.logradouro ?? "",
    opcoes: [
      {
        id: "economico",
        nome: gratis ? "Entrega padrão (grátis)" : "Entrega padrão",
        prazo: `${faixa.prazo} a ${faixa.prazo + 3} dias úteis`,
        valor: Number((gratis ? 0 : faixa.base + extra).toFixed(2)),
      },
      {
        id: "expresso",
        nome: "Entrega expressa",
        prazo: `${Math.max(1, faixa.prazo - 2)} a ${faixa.prazo} dias úteis`,
        valor: Number((faixa.base * 1.85 + extra).toFixed(2)),
      },
    ],
  };
}

// ── Melhor Envio ──────────────────────────────────────────────────────────────

type MEServico = {
  id: number;
  name: string;
  price: string | null;
  custom_price: string | null;
  delivery_time: number;
  custom_delivery_range?: { min: number; max: number };
  delivery_range?: { min: number; max: number };
  company: { name: string };
  error: string | null;
};

async function cotarMelhorEnvio(
  cep: string,
  itens: number,
  subtotal: number,
): Promise<ShippingQuote | null> {
  const token = process.env["MELHOR_ENVIO_TOKEN"];
  if (!token) return null;

  const pesoKg = itens * 0.9;

  const body = {
    from: { postal_code: "14402130" },
    to: { postal_code: cep },
    package: { height: 15, width: 22, length: 35, weight: pesoKg },
    options: { receipt: false, own_hand: false },
    services: "",
  };

  let res: Response;
  try {
    res = await fetch("https://melhorenvio.com.br/api/v2/me/shipment/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "solatto/1.0 (solattoecom@gmail.com)",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const servicos = (await res.json()) as MEServico[];
  if (!Array.isArray(servicos)) return null;

  const validos = servicos
    .filter((s) => s.error === null && s.price !== null)
    .sort((a, b) => Number(a.price) - Number(b.price));

  if (validos.length === 0) return null;

  // Busca cidade/bairro via ViaCEP para preencher o retorno
  let cidade = "";
  let uf = "";
  let bairro = "";
  let logradouro = "";
  try {
    const vr = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (vr.ok) {
      const ve = (await vr.json()) as {
        localidade?: string; uf?: string; bairro?: string; logradouro?: string;
      };
      cidade = ve.localidade ?? "";
      uf = ve.uf ?? "";
      bairro = ve.bairro ?? "";
      logradouro = ve.logradouro ?? "";
    }
  } catch { /* ignora */ }

  const gratis = subtotal >= 399.9;

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

  const opcoes: ShippingOption[] = [mapear(validos[0]!, "economico")];
  if (validos[1]) opcoes.push(mapear(validos[1], "expresso"));

  return {
    cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
    cidade,
    uf,
    bairro,
    logradouro,
    opcoes,
  };
}

// ── server function pública ───────────────────────────────────────────────────

export const quoteShipping = createServerFn({ method: "POST" })
  .validator((input: QuoteInput) => input)
  .handler(async ({ data }): Promise<ShippingQuote> => {
    const cep = String(data.cep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) throw new Error("CEP inválido. Digite os 8 números.");

    const itens = Math.max(1, Number(data.itens) || 1);
    const subtotal = Math.max(0, Number(data.subtotal) || 0);
    const clientTipo = data.clientTipo ?? "varejo";

    if (clientTipo !== "atacado") {
      const resultado = await cotarMelhorEnvio(cep, itens, subtotal);
      if (resultado) return resultado;
    }

    return cotarPorTabela(cep, itens, subtotal);
  });
```

- [ ] **Verificar TypeScript sem erros:**

```bash
cd C:/Users/vande/Usersvandee-commerce && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit:**

```bash
git add src/lib/shipping.functions.ts
git commit -m "feat: quoteShipping as createServerFn with Melhor Envio API"
```

---

## Task 2: Atualizar chamada em `checkout.functions.ts`

**Files:**
- Modify: `src/lib/checkout.functions.ts`

- [ ] **Atualizar a chamada de `quoteShipping` (linha ~135) para nova sintaxe e passar `clientTipo`:**

Localizar:
```typescript
const shippingQuote = await quoteShipping({ cep: address.cep, itens: data.items.length, subtotal });
```

Substituir por:
```typescript
const shippingQuote = await quoteShipping({ data: { cep: address.cep, itens: data.items.length, subtotal, clientTipo: clientType as "varejo" | "atacado" | "dropshipping" } });
```

- [ ] **Verificar TypeScript:**

```bash
cd C:/Users/vande/Usersvandee-commerce && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit:**

```bash
git add src/lib/checkout.functions.ts
git commit -m "fix: pass clientTipo to quoteShipping in checkout server fn"
```

---

## Task 3: Atualizar chamada em `checkout.tsx`

**Files:**
- Modify: `src/routes/_authenticated/checkout.tsx`

- [ ] **Adicionar estado para `clientTipo` após os outros estados (linha ~46):**

```typescript
const [clientTipo, setClientTipo] = useState<"varejo" | "atacado" | "dropshipping">("varejo");
```

- [ ] **Adicionar `useEffect` para buscar o tipo do cliente após o `user` estar disponível. Inserir logo após o `useEffect` existente do navigate:**

```typescript
useEffect(() => {
  if (!user?.id) return;
  void supabase
    .from("user_client_types")
    .select("tipo")
    .eq("user_id", user.id)
    .maybeSingle()
    .then(({ data }) => {
      if (data?.tipo) setClientTipo(data.tipo as "varejo" | "atacado" | "dropshipping");
    });
}, [user?.id]);
```

- [ ] **Verificar que `supabase` está importado no arquivo. Se não estiver, adicionar:**

```typescript
import { supabase } from "@/integrations/supabase/external";
```

- [ ] **Atualizar a chamada de `quoteShipping` em `handleGoToShipping`:**

Localizar:
```typescript
const quote = await quoteShipping({ cep: selectedAddress.cep, itens: itemCount, subtotal: total });
```

Substituir por:
```typescript
const quote = await quoteShipping({ data: { cep: selectedAddress.cep, itens: itemCount, subtotal: total, clientTipo } });
```

- [ ] **Verificar TypeScript:**

```bash
cd C:/Users/vande/Usersvandee-commerce && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit:**

```bash
git add src/routes/_authenticated/checkout.tsx
git commit -m "fix: fetch clientTipo and pass to quoteShipping in checkout"
```

---

## Task 4: Atualizar chamadas em `ShippingCalculator.tsx` e `produto.$slug.tsx`

**Files:**
- Modify: `src/components/ShippingCalculator.tsx`
- Modify: `src/routes/produto.$slug.tsx`

- [ ] **Em `ShippingCalculator.tsx`, atualizar a chamada (linha ~29):**

Localizar:
```typescript
const result = await quoteShipping({ cep, itens, subtotal });
```

Substituir por:
```typescript
const result = await quoteShipping({ data: { cep, itens, subtotal } });
```

- [ ] **Em `produto.$slug.tsx`, atualizar as 2 chamadas (linhas ~525 e ~544):**

Localizar (ambas):
```typescript
const r = await quoteShipping({ cep, itens: 1, subtotal: preco ? Number(preco.preco) : 0 });
```

Substituir por:
```typescript
const r = await quoteShipping({ data: { cep, itens: 1, subtotal: preco ? Number(preco.preco) : 0 } });
```

- [ ] **Verificar TypeScript:**

```bash
cd C:/Users/vande/Usersvandee-commerce && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit:**

```bash
git add src/components/ShippingCalculator.tsx src/routes/produto.$slug.tsx
git commit -m "fix: update quoteShipping call syntax in calculator and product page"
```

---

## Task 5: Atualizar `tracking-cron.ts` para usar Melhor Envio

**Files:**
- Modify: `src/lib/tracking-cron.ts`

- [ ] **Substituir o conteúdo completo do arquivo:**

```typescript
import { enviarEmailAvaliacao } from "@/lib/email.functions";

type METrackingEvento = {
  status: string;
  description?: string;
};

type METrackingItem = {
  events?: METrackingEvento[];
  status?: string;
};

type METrackingResposta = Record<string, METrackingItem>;

async function isEntregue(codigo: string): Promise<boolean> {
  // Tenta Melhor Envio primeiro
  const token = process.env["MELHOR_ENVIO_TOKEN"];
  if (token) {
    try {
      const res = await fetch(
        `https://melhorenvio.com.br/api/v2/me/shipment/tracking?orders[]=${encodeURIComponent(codigo)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "User-Agent": "solatto/1.0 (solattoecom@gmail.com)",
          },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as METrackingResposta;
        const item = data[codigo];
        if (item) {
          const status = item.status?.toLowerCase() ?? "";
          if (status === "delivered" || status === "entregue") return true;
          const eventos = item.events ?? [];
          return eventos.some(
            (e) =>
              e.status?.toLowerCase() === "delivered" ||
              e.description?.toLowerCase().includes("entregue ao destinat"),
          );
        }
      }
    } catch { /* fallback para Correios */ }
  }

  // Fallback: Correios
  try {
    const res = await fetch(`https://proxyapp.correios.com.br/v1/sro-rastro/${codigo}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      objeto?: { evento?: { descricao?: string; tipo?: string }[] }[];
    };
    const eventos = data.objeto?.[0]?.evento ?? [];
    return eventos.some(
      (e) =>
        e.descricao?.toLowerCase().includes("entregue ao destinatário") ||
        e.tipo === "BDE" ||
        e.tipo === "BDES",
    );
  } catch {
    return false;
  }
}

export async function runTrackingCron(): Promise<Response> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, usuario_id, codigo_rastreio, order_items(products(nome, slug))")
      .eq("status", "enviado")
      .not("codigo_rastreio", "is", null);

    if (!orders || orders.length === 0) return new Response("no orders", { status: 200 });

    let updated = 0;

    for (const order of orders) {
      const entregue = await isEntregue(order.codigo_rastreio!);
      if (!entregue) continue;

      await supabaseAdmin.from("orders").update({ status: "entregue" }).eq("id", order.id);
      updated++;

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("nome, email")
        .eq("id", order.usuario_id)
        .single();

      if (profile?.email) {
        const itens = ((order.order_items ?? []) as { products: { nome: string; slug: string } | null }[])
          .filter((i) => i.products)
          .map((i) => ({ nome: i.products!.nome, slug: i.products!.slug }));

        void enviarEmailAvaliacao({
          email: profile.email,
          nome: profile.nome,
          pedido_id: order.id,
          itens,
        }).catch(() => {});
      }
    }

    return new Response(`ok: ${updated} entregue(s)`, { status: 200 });
  } catch (err) {
    console.error("[cron-rastreio]", err);
    return new Response("error", { status: 500 });
  }
}
```

- [ ] **Verificar TypeScript:**

```bash
cd C:/Users/vande/Usersvandee-commerce && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit:**

```bash
git add src/lib/tracking-cron.ts
git commit -m "fix: update tracking cron to use Melhor Envio API with Correios fallback"
```

---

## Task 6: Push e configuração do Vercel

- [ ] **Push de todos os commits:**

```bash
cd C:/Users/vande/Usersvandee-commerce && git push
```

- [ ] **Adicionar `MELHOR_ENVIO_TOKEN` nas variáveis de ambiente do Vercel:**

Acesse o painel do Vercel → projeto Solatto → Settings → Environment Variables → adicionar:
- Key: `MELHOR_ENVIO_TOKEN`
- Value: o token gerado no Melhor Envio
- Environments: Production, Preview

Depois fazer um novo deploy (ou ele ocorre automaticamente após o push).

- [ ] **Testar em produção:** acessar a página de produto, digitar um CEP e verificar se as cotações reais do Melhor Envio aparecem com transportadora e prazo real.
