# Design: Integração Melhor Envio

## Contexto

O projeto Solatto e-commerce usa uma função `quoteShipping` com cálculo estimado por tabela regional. Esta integração substitui esse cálculo pela API do Melhor Envio para clientes varejo e dropshipping, e atualiza o cron de rastreio para usar a API unificada do Melhor Envio.

## Escopo

1. Converter `quoteShipping` em `createServerFn` e chamar a API do Melhor Envio para varejo/dropshipping
2. Manter tabela regional estimada para atacado
3. Atualizar `tracking-cron.ts` para usar a API de rastreio do Melhor Envio

## Dados do negócio

- CEP de origem: `14402-130` (Franca/SP)
- Dimensões por par: 35cm × 22cm × 15cm
- Peso por par: 900g (média de 600g–1,2kg incluindo caixa)
- Frete grátis: subtotal ≥ R$ 399,90 (só entrega padrão)

## Arquitetura

### `quoteShipping` como server function

`shipping.functions.ts` passa a exportar um `createServerFn` do TanStack Start. Os 4 chamadores existentes (`ShippingCalculator`, `produto.$slug.tsx`, `checkout.tsx`, `checkout.functions.ts`) continuam chamando `await quoteShipping(...)` sem mudança de interface, exceto pelo novo campo `clientTipo`.

**Assinatura:**
```ts
quoteShipping({ cep: string; itens: number; subtotal: number; clientTipo?: "varejo" | "atacado" | "dropshipping" })
```

`clientTipo` é opcional e padrão `"varejo"`. Chamadores sem contexto de tipo (página de produto, componente de carrinho) omitem o campo.

### Roteamento por tipo de cliente

```
clientTipo === "atacado"  →  tabela regional estimada (atual)
clientTipo !== "atacado"  →  Melhor Envio API
```

### Chamada à API do Melhor Envio

**Endpoint:** `POST https://melhorenvio.com.br/api/v2/me/shipment/calculate`

**Headers:**
```
Authorization: Bearer {process.env.MELHOR_ENVIO_TOKEN}
Content-Type: application/json
Accept: application/json
User-Agent: solatto/1.0 (solattoecom@gmail.com)
```

**Body:**
```json
{
  "from": { "postal_code": "14402130" },
  "to": { "postal_code": "<CEP destino sem hífen>" },
  "package": {
    "height": 15,
    "width": 22,
    "length": 35,
    "weight": "<itens × 0.9>"
  },
  "options": { "receipt": false, "own_hand": false },
  "services": ""
}
```

### Mapeamento da resposta

A API retorna array de transportadoras. Filtrar apenas as que têm `price` numérico e `error` ausente. Ordenar por `price` crescente. Mapear:

- `opcoes[0]` → `id: "economico"`, nome: "Entrega padrão" (ou "Entrega padrão (grátis)" se subtotal ≥ 399,90), `valor: gratis ? 0 : price`
- `opcoes[1]` → `id: "expresso"`, nome da transportadora + serviço, `valor: price`

Se a API retornar menos de 2 opções válidas, preencher com a tabela regional como fallback.

### Fallback

Se a chamada ao Melhor Envio falhar (erro HTTP, timeout de 10s, resposta vazia), usar a tabela regional estimada silenciosamente.

### Variável de ambiente

`MELHOR_ENVIO_TOKEN` — já adicionada ao `.env`. Deve ser adicionada também nas variáveis de ambiente do Vercel.

---

## Atualização do Tracking Cron

### Situação atual

`tracking-cron.ts` consulta diretamente `https://proxyapp.correios.com.br/v1/sro-rastro/{codigo}` para detectar entrega. Só funciona com Correios.

### Nova implementação

Substituir a função `isEntregue` para usar a API de rastreio do Melhor Envio:

**Endpoint:** `GET https://melhorenvio.com.br/api/v2/me/shipment/tracking?orders={codigo}`

**Headers:** mesmo `Authorization` e `User-Agent`.

**Detecção de entrega:** checar se o último evento do tracking tem status que indica entrega (`"delivered"`, `"ENTREGUE"`, ou similar conforme resposta da API).

**Fallback:** se o Melhor Envio não retornar rastreio para o código (ex: código de transportadora não suportada), manter a lógica atual dos Correios como fallback.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/shipping.functions.ts` | Reescrever como `createServerFn`, adicionar chamada Melhor Envio |
| `src/lib/tracking-cron.ts` | Substituir `isEntregue` para usar API Melhor Envio com fallback Correios |
| `src/components/ShippingCalculator.tsx` | Passar `clientTipo` se disponível (opcional) |
| `src/routes/_authenticated/checkout.tsx` | Passar `clientTipo` do usuário autenticado |
| `src/lib/checkout.functions.ts` | Passar `clientTipo` do perfil do usuário |
| `.env` | `MELHOR_ENVIO_TOKEN` já adicionado |

## Fora do escopo

- Integração com APIs das transportadoras de atacado (Braspress, Rodonaves, etc.)
- Geração de etiquetas via Melhor Envio
- Rastreio em tempo real na página de pedidos (atualização via cron continua sendo o mecanismo)
