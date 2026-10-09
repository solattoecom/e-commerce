# Remoção do Atacado + Etiqueta Dropshipping — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover o tipo "atacado" do sistema e implementar upload de etiqueta de frete no checkout para clientes dropshipping, com download no painel admin.

**Architecture:** Dropshipping não gera cotação de frete — retorna opção gratuita fixa. O arquivo de etiqueta é enviado como base64 no payload de `createOrder`, gravado no Supabase Storage bucket `etiquetas`, e o path salvo em `orders.etiqueta_path`. Admin baixa via URL assinada gerada por server function.

**Tech Stack:** React + TanStack Router/Start, Supabase (Postgres + Storage), TypeScript, Bun

---

## Mapa de Arquivos

| Arquivo | O que muda |
|---|---|
| `supabase/migrations/20260921000000_remove_atacado_etiqueta.sql` | Criar — migração DB |
| `src/integrations/supabase/types.ts` | Modificar — enum e coluna `etiqueta_path` |
| `src/hooks/useAuth.ts` | Modificar — remover `atacado` do `ClientType` |
| `src/lib/shipping.functions.ts` | Modificar — remover atacado, dropshipping retorna opção grátis |
| `src/lib/checkout.functions.ts` | Modificar — remover atacado, aceitar arquivo, upload Storage |
| `src/lib/label.functions.ts` | Modificar — adicionar `getEtiquetaUrl` server function |
| `src/components/AdminProdutos.tsx` | Modificar — remover `atacado` de `TIPOS_PRECO` |
| `src/routes/entrar.tsx` | Modificar — remover `atacado` de `accountTypes` |
| `src/routes/sobre.tsx` | Modificar — remover "atacado" do texto |
| `src/routes/termos.tsx` | Modificar — remover "atacado" do texto |
| `src/routes/_authenticated/admin.tsx` | Modificar — remover atacado, adicionar botão download etiqueta |
| `src/routes/_authenticated/checkout.tsx` | Modificar — remover atacado, adicionar upload de etiqueta |

---

## Task 1: Migração do banco de dados

**Files:**
- Create: `supabase/migrations/20260921000000_remove_atacado_etiqueta.sql`

- [ ] **Step 1: Criar arquivo de migração**

```sql
-- Remove atacado values and add etiqueta_path column

-- 1. Limpa registros com tipos atacado
DELETE FROM public.user_client_types
  WHERE tipo IN ('atacado', 'atacado_presencial', 'atacado_distancia');

DELETE FROM public.client_type_requests
  WHERE tipo_solicitado IN ('atacado', 'atacado_presencial', 'atacado_distancia');

-- 2. Cria novo enum sem atacado
CREATE TYPE public.app_client_type_new AS ENUM ('varejo', 'dropshipping');

-- 3. Altera coluna user_client_types.tipo
ALTER TABLE public.user_client_types
  ALTER COLUMN tipo TYPE public.app_client_type_new
  USING tipo::text::public.app_client_type_new;

-- 4. Altera coluna client_type_requests.tipo_solicitado
ALTER TABLE public.client_type_requests
  ALTER COLUMN tipo_solicitado TYPE public.app_client_type_new
  USING tipo_solicitado::text::public.app_client_type_new;

-- 5. Troca enums
DROP TYPE public.app_client_type;
ALTER TYPE public.app_client_type_new RENAME TO app_client_type;

-- 6. Adiciona coluna para path da etiqueta
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS etiqueta_path text;

-- 7. Cria bucket privado para etiquetas (idempotente)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('etiquetas', 'etiquetas', false)
  ON CONFLICT (id) DO NOTHING;

-- 8. Policy: admin pode ler etiquetas
CREATE POLICY "admin_select_etiquetas" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'etiquetas'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
```

- [ ] **Step 2: Aplicar a migração no banco**

Rode no SQL Editor do Supabase Dashboard (ou via `supabase db push` quando Docker estiver disponível).

Verifique no Dashboard → Table Editor → `user_client_types` que a coluna `tipo` não aceita mais "atacado".
Verifique em Table Editor → `orders` que a coluna `etiqueta_path` existe.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/vande/Usersvandee-commerce
git add supabase/migrations/20260921000000_remove_atacado_etiqueta.sql
git commit -m "feat: migração remove atacado e adiciona etiqueta_path em orders"
```

---

## Task 2: Atualizar tipos gerados do Supabase

**Files:**
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Atualizar enum `app_client_type`**

Em `src/integrations/supabase/types.ts`, linha 762, trocar:

```typescript
      app_client_type:
        | "varejo"
        | "atacado"
        | "dropshipping"
        | "atacado_presencial"
        | "atacado_distancia"
```

Por:

```typescript
      app_client_type:
        | "varejo"
        | "dropshipping"
```

- [ ] **Step 2: Adicionar `etiqueta_path` no tipo `orders`**

Na seção `Row` da tabela `orders` (em torno da linha 285), adicionar após `endereco: Json`:

```typescript
          etiqueta_path: string | null
```

Na seção `Insert`:

```typescript
          etiqueta_path?: string | null
```

Na seção `Update`:

```typescript
          etiqueta_path?: string | null
```

- [ ] **Step 3: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore: atualiza tipos Supabase — remove atacado, adiciona etiqueta_path"
```

---

## Task 3: Remover atacado de `useAuth.ts`

**Files:**
- Modify: `src/hooks/useAuth.ts:6`

- [ ] **Step 1: Atualizar `ClientType`**

Trocar linha 6:

```typescript
export type ClientType = "varejo" | "atacado" | "dropshipping";
```

Por:

```typescript
export type ClientType = "varejo" | "dropshipping";
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAuth.ts
git commit -m "feat: remove atacado do ClientType"
```

---

## Task 4: Atualizar `shipping.functions.ts`

**Files:**
- Modify: `src/lib/shipping.functions.ts`

- [ ] **Step 1: Atualizar `QuoteInput` e remover lógica atacado**

Trocar o tipo `QuoteInput` (linha 20-25):

```typescript
type QuoteInput = {
  cep: string;
  itens: number;
  subtotal: number;
  clientTipo?: "varejo" | "dropshipping";
};
```

Trocar o comentário da tabela regional (linha 27):

```typescript
// ── tabela regional (fallback quando Melhor Envio falha) ─────────────────────
```

- [ ] **Step 2: Atualizar o handler do `quoteShipping`**

Substituir o bloco `handler` inteiro (linhas 237-251):

```typescript
  .handler(async ({ data }): Promise<ShippingQuote> => {
    const cep = String(data.cep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) throw new Error("CEP inválido. Digite os 8 números.");

    const itens = Math.max(1, Number(data.itens) || 1);
    const subtotal = Math.max(0, Number(data.subtotal) || 0);
    const clientTipo = data.clientTipo ?? "varejo";

    if (clientTipo === "dropshipping") {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const endereco = res.ok ? (await res.json()) as { localidade?: string; uf?: string; bairro?: string; logradouro?: string; erro?: boolean } : {};
      return {
        cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
        cidade: (!endereco.erro && endereco.localidade) ? endereco.localidade : "",
        uf: (!endereco.erro && endereco.uf) ? endereco.uf : "",
        bairro: (!endereco.erro && endereco.bairro) ? endereco.bairro : "",
        logradouro: (!endereco.erro && endereco.logradouro) ? endereco.logradouro : "",
        opcoes: [
          {
            id: "etiqueta_propria",
            nome: "Etiqueta própria — você fornece a etiqueta",
            prazo: "Conforme sua transportadora",
            valor: 0,
          },
        ],
      };
    }

    const resultado = await cotarMelhorEnvio(cep, itens, subtotal);
    if (resultado) return resultado;

    return cotarPorTabela(cep, itens, subtotal);
  });
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shipping.functions.ts
git commit -m "feat: dropshipping retorna etiqueta própria sem frete; remove lógica atacado"
```

---

## Task 5: Atualizar `checkout.functions.ts`

**Files:**
- Modify: `src/lib/checkout.functions.ts`

- [ ] **Step 1: Adicionar campos de etiqueta em `CreateOrderInput`**

Substituir o tipo `CreateOrderInput` (linhas 18-34):

```typescript
type CreateOrderInput = {
  address_id: string;
  shipping_option_id: string;
  shipping_nome: string;
  payment_method: "pix" | "cartao" | "boleto";
  telefone: string;
  items: OrderItem[];
  card_number?: string;
  card_holder?: string;
  card_expiry?: string;
  card_cvv?: string;
  card_cpf?: string;
  card_telefone?: string;
  card_parcelas?: number;
  boleto_cpf?: string;
  coupon_id?: string | null;
  etiqueta_file_base64?: string;
  etiqueta_file_ext?: string;
};
```

- [ ] **Step 2: Remover `atacado` do cast de `clientType` e do `quoteShipping`**

Substituir linha 76:

```typescript
    const clientType = clientTypeRow?.tipo ?? "varejo";
```

Por (sem mudança — já está correto, só o tipo muda).

Substituir linha 135:

```typescript
    const shippingQuote = await quoteShipping({ data: { cep: address.cep, itens: data.items.length, subtotal, clientTipo: clientType as "varejo" | "dropshipping" } });
```

- [ ] **Step 3: Adicionar variável `etiquetaPath` e upload após criação do pedido**

Logo após a linha `let desconto = 0;` (linha ~110), adicionar:

```typescript
    let etiquetaPath: string | null = null;
```

Substituir a função `cancelarPedido` (linhas 200-210):

```typescript
    async function cancelarPedido() {
      for (const item of itemsComPreco) {
        if (!item.variacao_id) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin.rpc as any)("restore_stock", {
          p_variacao_id: item.variacao_id,
          p_quantidade: item.quantidade,
        });
      }
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      if (etiquetaPath) {
        await supabaseAdmin.storage.from("etiquetas").remove([etiquetaPath]);
      }
    }
```

Após o bloco que reserva estoque (após linha ~197, logo antes de `const headers = {`), adicionar o upload da etiqueta:

```typescript
    // Upload da etiqueta para dropshipping
    if (clientType === "dropshipping" && data.etiqueta_file_base64) {
      const ext = (data.etiqueta_file_ext ?? "pdf").replace(/[^a-z0-9]/gi, "").toLowerCase();
      const allowedExts = ["pdf", "jpg", "jpeg", "png", "webp"];
      if (allowedExts.includes(ext)) {
        const path = `${order.id}/etiqueta.${ext}`;
        const buf = Buffer.from(data.etiqueta_file_base64, "base64");
        if (buf.length <= 10 * 1024 * 1024) { // máx 10MB
          const contentType = ext === "pdf" ? "application/pdf" : `image/${ext}`;
          const { error: uploadErr } = await supabaseAdmin.storage
            .from("etiquetas")
            .upload(path, buf, { contentType, upsert: true });
          if (!uploadErr) {
            etiquetaPath = path;
            await supabaseAdmin.from("orders").update({ etiqueta_path: path }).eq("id", order.id);
          }
        }
      }
    }
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/checkout.functions.ts
git commit -m "feat: checkout aceita etiqueta dropshipping e faz upload para Storage"
```

---

## Task 6: Adicionar `getEtiquetaUrl` em `label.functions.ts`

**Files:**
- Modify: `src/lib/label.functions.ts`

- [ ] **Step 1: Ler o arquivo atual**

```bash
cat src/lib/label.functions.ts | grep -n "createServerFn\|export" | head -20
```

- [ ] **Step 2: Adicionar server function ao final do arquivo**

```typescript
export const getEtiquetaUrl = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { order_id: string }) => input)
  .handler(async ({ data }): Promise<{ url: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("etiqueta_path")
      .eq("id", data.order_id)
      .single();

    if (!order?.etiqueta_path) throw new Error("Etiqueta não encontrada para este pedido.");

    const { data: signed, error } = await supabaseAdmin.storage
      .from("etiquetas")
      .createSignedUrl(order.etiqueta_path, 120);

    if (error || !signed) throw new Error("Não foi possível gerar o link de download.");

    return { url: signed.signedUrl };
  });
```

Verificar qual middleware é usado para admin (provavelmente `requireAdmin` ou similar — se não existir, usar `requireSupabaseAuth` + verificação de role manualmente).

- [ ] **Step 3: Verificar o import correto do middleware admin**

```bash
grep -n "requireAdmin\|isAdmin\|has_role" src/lib/label.functions.ts src/lib/admin.functions.ts | head -10
```

Se o arquivo usa um padrão diferente de autenticação admin, adaptar o handler para verificar `has_role` via `supabaseAdmin`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/label.functions.ts
git commit -m "feat: server function getEtiquetaUrl para download de etiqueta dropshipping"
```

---

## Task 7: Remover atacado de `AdminProdutos.tsx`

**Files:**
- Modify: `src/components/AdminProdutos.tsx`

- [ ] **Step 1: Atualizar `TIPOS_PRECO`**

Substituir linha 32:

```typescript
const TIPOS_PRECO = ["varejo", "atacado", "dropshipping"] as const
```

Por:

```typescript
const TIPOS_PRECO = ["varejo", "dropshipping"] as const
```

- [ ] **Step 2: Remover `atacado` dos estados iniciais de preços**

Substituir todas as inicializações do estado `precos` (há 3 ocorrências: linha ~70, ~110, ~129):

```typescript
  const [precos, setPrecos] = useState<Record<TipoPreco, PrecoLocal>>({
    varejo: { preco: "", preco_original: "" },
    dropshipping: { preco: "", preco_original: "" },
  })
```

E nos dois outros locais (dentro de `abrirNovo` e `abrirEditar`):

```typescript
    const precosIniciais: Record<TipoPreco, PrecoLocal> = {
      varejo: { preco: "", preco_original: "" },
      dropshipping: { preco: "", preco_original: "" },
    }
```

(Remover as linhas `atacado: { preco: "", preco_original: "" },` das 3 ocorrências)

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminProdutos.tsx
git commit -m "feat: remove atacado dos tipos de preço em AdminProdutos"
```

---

## Task 8: Remover atacado de `entrar.tsx`

**Files:**
- Modify: `src/routes/entrar.tsx`

- [ ] **Step 1: Remover item atacado de `accountTypes`**

Substituir o array `accountTypes` (linhas 23-27):

```typescript
const accountTypes = [
  { id: "varejo", name: "Varejo", Icon: Store },
  { id: "dropshipping", name: "Drops", Icon: Truck },
] as const;
```

- [ ] **Step 2: Remover import de `Building2`**

Trocar linha 3:

```typescript
import { Building2, Store, Truck } from "lucide-react";
```

Por:

```typescript
import { Store, Truck } from "lucide-react";
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/entrar.tsx
git commit -m "feat: remove atacado do seletor de tipo de conta"
```

---

## Task 9: Atualizar textos em `sobre.tsx` e `termos.tsx`

**Files:**
- Modify: `src/routes/sobre.tsx`
- Modify: `src/routes/termos.tsx`

- [ ] **Step 1: Verificar contexto exato das linhas em sobre.tsx**

```bash
grep -n "atacado" src/routes/sobre.tsx -B2 -A2
```

Substituir a frase com "atacado" (linha ~88) — exemplo típico:

> "A expansão para o atacado e o dropshipping abriu caminho..."

Por:

> "A expansão para o dropshipping abriu caminho..."

- [ ] **Step 2: Verificar contexto em termos.tsx**

```bash
grep -n "atacado" src/routes/termos.tsx -B2 -A2
```

Substituir (linha ~47):

> "Atendemos clientes nos segmentos varejo, atacado e dropshipping em todo o território nacional."

Por:

> "Atendemos clientes nos segmentos varejo e dropshipping em todo o território nacional."

- [ ] **Step 3: Commit**

```bash
git add src/routes/sobre.tsx src/routes/termos.tsx
git commit -m "chore: remove menção a atacado nos textos institucionais"
```

---

## Task 10: Atualizar `admin.tsx` — texto e download de etiqueta

**Files:**
- Modify: `src/routes/_authenticated/admin.tsx`

- [ ] **Step 1: Atualizar meta description**

Substituir linha 24:

```typescript
          "Aprove contas de atacado e dropshipping e acompanhe os pedidos da loja Solatto.",
```

Por:

```typescript
          "Aprove contas de dropshipping e acompanhe os pedidos da loja Solatto.",
```

- [ ] **Step 2: Atualizar o cast de tipo em `decidir()`**

Substituir linha 254:

```typescript
            { user_id: s.user_id, tipo: s.tipo_solicitado as "varejo" | "atacado" | "dropshipping" },
```

Por:

```typescript
            { user_id: s.user_id, tipo: s.tipo_solicitado as "varejo" | "dropshipping" },
```

- [ ] **Step 3: Adicionar `etiqueta_path` ao tipo `Pedido`**

No tipo `Pedido` (linhas 60-80), adicionar após `me_order_id`:

```typescript
  etiqueta_path: string | null;
```

- [ ] **Step 4: Adicionar `etiqueta_path` ao select de pedidos**

Na query de `carregar()` (linha ~226), adicionar `etiqueta_path` à string de select:

```typescript
          "id, status, subtotal, frete, total, coupon_id, payment_method, card_parcelas, nota_fiscal, codigo_rastreio, label_pdf_url, etiqueta_path, me_service_id, me_order_id, ultimo_evento_rastreio, criado_em, usuario_id, endereco, profiles(nome, email), order_items(id, quantidade, preco_unitario, subtotal, products(nome, slug, product_images(url)), product_variants(tamanho))",
```

- [ ] **Step 5: Importar `getEtiquetaUrl` e adicionar estado**

No topo do arquivo, adicionar ao import de label.functions:

```typescript
import { generateLabel, getMelhorEnvioSaldo, reprintLabel, getEtiquetaUrl } from "@/lib/label.functions";
```

Junto com os outros estados de label (linha ~207), adicionar:

```typescript
  const [etiquetaOcupado, setEtiquetaOcupado] = useState<string | null>(null);
```

- [ ] **Step 6: Adicionar função de download e botão na UI**

Após a função `handleLoadTracking` (encontrar onde fica o bloco de funções), adicionar:

```typescript
  async function handleDownloadEtiqueta(pedidoId: string) {
    setEtiquetaOcupado(pedidoId);
    try {
      const { url } = await getEtiquetaUrl({ data: { order_id: pedidoId } });
      const a = document.createElement("a");
      a.href = url;
      a.download = `etiqueta-${pedidoId.slice(0, 8)}.pdf`;
      a.click();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao baixar etiqueta.");
    } finally {
      setEtiquetaOcupado(null);
    }
  }
```

Na seção de render de cada pedido (onde fica o botão de gerar etiqueta ME), adicionar, condicionalmente, o botão de download **quando `pedido.etiqueta_path` existir**. Localizar na UI a área de ações do pedido e inserir:

```tsx
{pedido.etiqueta_path && (
  <button
    type="button"
    disabled={etiquetaOcupado === pedido.id}
    onClick={() => handleDownloadEtiqueta(pedido.id)}
    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
  >
    {etiquetaOcupado === pedido.id ? "Baixando..." : "Baixar Etiqueta"}
  </button>
)}
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/_authenticated/admin.tsx
git commit -m "feat: admin — remove texto atacado, adiciona download de etiqueta dropshipping"
```

---

## Task 11: Atualizar `checkout.tsx` — remover atacado e adicionar upload de etiqueta

**Files:**
- Modify: `src/routes/_authenticated/checkout.tsx`

- [ ] **Step 1: Atualizar tipo do estado `clientTipo`**

Substituir linha 62:

```typescript
  const [clientTipo, setClientTipo] = useState<"varejo" | "atacado" | "dropshipping">("varejo");
```

Por:

```typescript
  const [clientTipo, setClientTipo] = useState<"varejo" | "dropshipping">("varejo");
```

- [ ] **Step 2: Atualizar o cast no useEffect**

Substituir linha 49:

```typescript
        if (data?.tipo) setClientTipo(data.tipo as "varejo" | "atacado" | "dropshipping");
```

Por:

```typescript
        if (data?.tipo) setClientTipo(data.tipo as "varejo" | "dropshipping");
```

- [ ] **Step 3: Adicionar estado para o arquivo de etiqueta**

Logo após `const [clientTipo, ...]` (linha ~62), adicionar:

```typescript
  const [etiquetaFile, setEtiquetaFile] = useState<File | null>(null);
  const [etiquetaErro, setEtiquetaErro] = useState<string | null>(null);
```

- [ ] **Step 4: Adicionar validação no `handleGoToPayment`**

Substituir a função `handleGoToPayment` (linhas 165-169):

```typescript
  const handleGoToPayment = () => {
    if (!selectedShipping) { setErro("Selecione uma opção de entrega."); return; }
    if (clientTipo === "dropshipping" && !etiquetaFile) {
      setErro("Faça upload da sua etiqueta de frete antes de continuar.");
      return;
    }
    setErro(null);
    setStep("pagamento");
  };
```

- [ ] **Step 5: Passar etiqueta no `createOrder`**

No bloco `handlePay`, adicionar conversão de arquivo para base64 antes de chamar `createOrder`.

Substituir o bloco de início de `handlePay` (antes da chamada `createOrder`):

```typescript
  const handlePay = async () => {
    if (!selectedAddressId || !selectedShipping) {
      setErro("Selecione endereço e frete antes de pagar.");
      return;
    }
    const cpfDigits = profileCpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) { setErro("Informe um CPF válido com 11 dígitos."); return; }
    const telefoneDigits = telefone.replace(/\D/g, "");
    if (telefoneDigits.length < 10) { setErro("Informe um telefone válido com DDD."); return; }

    // Converte etiqueta para base64 (dropshipping)
    let etiquetaBase64: string | undefined;
    let etiquetaExt: string | undefined;
    if (clientTipo === "dropshipping" && etiquetaFile) {
      etiquetaBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(etiquetaFile);
      });
      etiquetaExt = etiquetaFile.name.split(".").pop()?.toLowerCase();
    }

    setBusy(true);
    setErro(null);
    try {
      await updateProfileCpf({ data: { cpf: cpfDigits } });
      const result = await createOrder({
        data: {
          address_id: selectedAddressId,
          shipping_option_id: selectedShipping.id,
          shipping_nome: selectedShipping.nome,
          payment_method: paymentMethod,
          telefone: telefone.replace(/\D/g, ""),
          items: items.map((item) => ({
            produto_id: item.produto_id,
            variacao_id: item.variacao_id,
            nome: item.products?.nome ?? "",
            quantidade: item.quantidade,
          })),
          coupon_id: desconto?.coupon_id ?? null,
          ...(etiquetaBase64 && { etiqueta_file_base64: etiquetaBase64, etiqueta_file_ext: etiquetaExt }),
          ...(paymentMethod === "cartao" && {
            card_number: card.number,
            card_holder: card.holder,
            card_expiry: card.expiry,
            card_cvv: card.cvv,
            card_cpf: profileCpf,
            card_telefone: telefone.replace(/\D/g, ""),
            card_parcelas: Number(card.parcelas),
          }),
          ...(paymentMethod === "boleto" && { boleto_cpf: profileCpf }),
        },
      });
```

- [ ] **Step 6: Adicionar UI de upload na step "entrega"**

Na step "entrega", após a listagem das `shippingOptions`, adicionar condicionalmente o campo de upload para dropshipping:

```tsx
          {clientTipo === "dropshipping" && (
            <div className="space-y-2 rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium">Etiqueta de frete</p>
              <p className="text-xs text-muted-foreground">Faça upload da etiqueta da sua transportadora. Aceitamos PDF, JPG ou PNG (máx. 10 MB).</p>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && file.size > 10 * 1024 * 1024) {
                    setEtiquetaErro("Arquivo muito grande. Máximo 10 MB.");
                    setEtiquetaFile(null);
                  } else {
                    setEtiquetaErro(null);
                    setEtiquetaFile(file);
                  }
                }}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-background hover:file:bg-foreground/90"
              />
              {etiquetaErro && <p className="text-xs text-destructive">{etiquetaErro}</p>}
              {etiquetaFile && <p className="text-xs text-green-600">Arquivo selecionado: {etiquetaFile.name}</p>}
            </div>
          )}
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/_authenticated/checkout.tsx
git commit -m "feat: checkout dropshipping — remove atacado, adiciona upload de etiqueta"
```

---

## Task 12: Verificação final

- [ ] **Step 1: Verificar que não sobrou nenhuma referência a atacado**

```bash
grep -ri "atacado" src/ --include="*.ts" --include="*.tsx" | grep -v ".git"
```

Saída esperada: vazia (zero resultados).

- [ ] **Step 2: Build para confirmar sem erros de TypeScript**

```bash
cd /c/Users/vande/Usersvandee-commerce && bun run build 2>&1 | tail -30
```

Saída esperada: build completo sem erros de tipo.

- [ ] **Step 3: Commit final se necessário**

```bash
git add -A
git commit -m "chore: verificação final — sem referências a atacado"
```
