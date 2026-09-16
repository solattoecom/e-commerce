# Design: Melhor Envio — Fase 2: Etiquetas + Rastreio em Tempo Real

## Contexto

A Fase 1 integrou a API do Melhor Envio para cotação de frete. A Fase 2 fecha o ciclo logístico: geração de etiquetas diretamente do painel admin e rastreio em tempo real na página de pedidos do cliente.

## Escopo

1. Migration: adicionar `me_service_id` e `me_order_id` na tabela `orders`
2. Checkout: armazenar `me_service_id` ao criar pedido
3. Nova server function `generateLabel` para gerar etiqueta via Melhor Envio
4. Admin: botão "Gerar Etiqueta" + link para PDF
5. Cliente: timeline de rastreio em tempo real em `pedidos.tsx`

## Dados do remetente (fixos)

```
Razão social: SOLATTO COMERCIO DE CALCADOS ROUPAS E ACESSORIOS LTDA
CNPJ: 51.987.195/0001-46
Telefone: 16999136670
E-mail: solattoecom@gmail.com
Endereço: R ROMUALDO MAGALHAES PIRRO, 1050
Bairro: Jd do Eden
CEP: 14402-130
Cidade: Franca
UF: SP
País: BR
```

## Banco de dados

### Migration

Adicionar duas colunas à tabela `orders`:

```sql
ALTER TABLE public.orders
  ADD COLUMN me_service_id integer,
  ADD COLUMN me_order_id text;
```

- `me_service_id` — ID numérico do serviço Melhor Envio escolhido pelo cliente. Preenchido na criação do pedido. `null` para atacado e fallback regional.
- `me_order_id` — ID do pedido no Melhor Envio, retornado após geração da etiqueta. Usado para tracking em tempo real e impressão do PDF.

## Checkout — armazenar `me_service_id`

### `ShippingOption` (shipping.functions.ts)

Adicionar campo opcional:
```ts
export type ShippingOption = {
  id: string;
  nome: string;
  prazo: string;
  valor: number;
  me_service_id?: number; // ID do serviço ME (null para tabela regional)
};
```

### `cotarMelhorEnvio` (shipping.functions.ts)

Na função `mapear`, incluir `me_service_id: s.id` no objeto retornado.

### `checkout.functions.ts`

Ao inserir o pedido em `orders`, incluir `me_service_id` do `shippingOption.me_service_id ?? null`.

## Geração de etiqueta

### Novo arquivo: `src/lib/label.functions.ts`

Server function `generateLabel` (POST, requer auth):

**Input:** `{ order_id: string }`

**Fluxo:**
1. Busca pedido no banco (endereço destino em `endereco` JSON, `me_service_id`, items para calcular peso)
2. Valida: status deve ser `"pago"` ou `"processando"`, `me_service_id` não pode ser null
3. Chama sequência ME API:
   - `POST /api/v2/me/cart` — adiciona envio ao carrinho
   - `POST /api/v2/me/shipment/checkout` — confirma carrinho
   - `POST /api/v2/me/shipment/generate` — gera etiqueta
   - `GET /api/v2/me/shipment/print?orders[]={me_id}` — obtém URL do PDF
4. Atualiza `orders`: `me_order_id`, `codigo_rastreio` (código da transportadora), `status = "enviado"`
5. Retorna `{ pdf_url: string, codigo_rastreio: string }`

**Body do `POST /cart`:**
```json
{
  "service": <me_service_id>,
  "from": {
    "name": "SOLATTO COMERCIO DE CALCADOS ROUPAS E ACESSORIOS LTDA",
    "phone": "16999136670",
    "email": "solattoecom@gmail.com",
    "document": "51987195000146",
    "company_document": "51987195000146",
    "address": "R ROMUALDO MAGALHAES PIRRO",
    "number": "1050",
    "district": "Jd do Eden",
    "city": "Franca",
    "country_id": "BR",
    "postal_code": "14402130"
  },
  "to": {
    "name": "<profile.nome> <profile.sobrenome>",
    "phone": "<order.telefone>",
    "email": "<profile.email>",
    "address": "<endereco.rua>",
    "number": "<endereco.numero>",
    "complement": "<endereco.complemento>",
    "district": "<endereco.bairro>",
    "city": "<endereco.cidade>",
    "state_abbr": "<endereco.estado>",
    "country_id": "BR",
    "postal_code": "<endereco.cep sem hífen>"
  },
  "volumes": [{
    "height": 15,
    "width": 22,
    "length": 35,
    "weight": <itens * 0.9>
  }]
}
```

**Tratamento de erros:** qualquer falha na sequência lança erro com mensagem legível para o admin. O pedido não muda de status se a geração falhar.

### `src/integrations/supabase/types.ts`

Atualizar tipo `orders.Row` para incluir `me_service_id: number | null` e `me_order_id: string | null`.

## Painel Admin (`admin.tsx`)

- Botão **"Gerar Etiqueta"** visível em pedidos com `status === "pago" || status === "processando"` E `me_service_id !== null`
- Estado de loading durante a chamada
- Após sucesso: link **"Imprimir Etiqueta"** abrindo `pdf_url` em nova aba + `codigo_rastreio` preenchido automaticamente
- Em caso de erro: mensagem inline no pedido

## Rastreio em tempo real (`pedidos.tsx`)

### Nova server function: `src/lib/tracking.functions.ts`

`getTrackingEvents({ me_order_id: string })`:
- `GET https://melhorenvio.com.br/api/v2/me/shipment/tracking?orders[]={me_order_id}`
- Retorna array de eventos: `{ descricao: string; data: string; local?: string }[]`
- Em caso de erro ou array vazio, retorna `[]`

### UI em `pedidos.tsx`

Pedidos com `me_order_id` preenchido mostram uma **timeline vertical** com todos os eventos em ordem cronológica decrescente (mais recente no topo):

```
● Objeto entregue ao destinatário — 16/09 14:32 — Franca/SP
● Saiu para entrega — 16/09 08:10 — Franca/SP
● Em trânsito — 15/09 18:45 — São Paulo/SP
● Objeto postado — 14/09 10:00 — Franca/SP
```

Pedidos sem `me_order_id` (atacado, pedidos antigos) continuam exibindo o comportamento atual: `codigo_rastreio` com links para Correios e Linketrack.

Os eventos são carregados ao expandir o pedido (lazy load via server function).

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/YYYYMMDD_me_columns.sql` | Nova migration |
| `src/integrations/supabase/types.ts` | Atualizar tipo orders.Row |
| `src/lib/shipping.functions.ts` | Adicionar `me_service_id` em ShippingOption e mapear |
| `src/lib/checkout.functions.ts` | Salvar `me_service_id` ao criar pedido |
| `src/lib/label.functions.ts` | Novo — geração de etiqueta |
| `src/lib/tracking.functions.ts` | Novo — buscar eventos de rastreio |
| `src/routes/_authenticated/admin.tsx` | Botão gerar etiqueta + link PDF |
| `src/routes/_authenticated/pedidos.tsx` | Timeline de rastreio em tempo real |

## Fora do escopo

- Cancelamento de etiqueta via Melhor Envio
- Impressão em lote de etiquetas
- Notificações push/email a cada evento de rastreio
- Integração de rastreio para atacado (transportadoras próprias)
