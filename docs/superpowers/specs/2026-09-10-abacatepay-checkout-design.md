# Design: AbacatePay + Checkout + Meus Pedidos

## Escopo

Integração de pagamento via AbacatePay (Pix + Cartão de crédito), página de checkout em 3 etapas, aba "Meus Pedidos" no perfil do usuário e campo de NF-e no painel admin (rastreio de transportadoras fica para uma segunda fase, quando as credenciais das APIs estiverem disponíveis).

---

## 1. Banco de Dados

### Nova tabela `addresses`

Armazena múltiplos endereços por usuário.

```sql
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
```

RLS: usuário lê/escreve apenas seus próprios endereços.

### Colunas novas em `orders`

```sql
ALTER TABLE public.orders
  ADD COLUMN payment_method text CHECK (payment_method IN ('pix', 'cartao')),
  ADD COLUMN payment_id text,
  ADD COLUMN address_id uuid REFERENCES public.addresses(id),
  ADD COLUMN nota_fiscal text;
```

- `payment_method`: método escolhido pelo cliente
- `payment_id`: ID da cobrança retornado pelo AbacatePay
- `address_id`: endereço usado no pedido
- `nota_fiscal`: preenchido pelo admin ao enviar o pedido (base para rastreio futuro)

---

## 2. Página de Checkout (`/checkout`)

Rota protegida (requer login). Divide-se em 3 etapas sequenciais com barra de progresso.

### Etapa 1 — Endereço

- Lista endereços salvos do usuário com seleção
- Botão "Adicionar novo endereço" abre formulário com busca por CEP (reutiliza lógica do ShippingCalculator)
- Endereço padrão pré-selecionado
- Avança ao selecionar um endereço

### Etapa 2 — Entrega

- Chama `quoteShipping` com o CEP do endereço selecionado e itens do carrinho
- Exibe opções Econômico e Expresso com prazo e valor
- Usuário seleciona e avança

### Etapa 3 — Pagamento

- Seleção de método: **Pix** ou **Cartão de crédito**
- **Pix**: chama `createOrder`, exibe QR code e código copia-e-cola; polling a cada 5s em `getOrderStatus` até status `pago`; ao confirmar, redireciona para página de sucesso
- **Cartão**: formulário (número, nome, validade, CVV); ao submeter chama `createOrder`; aguarda resposta síncrona; redireciona para página de sucesso ou exibe erro

### Página de sucesso

Exibe número do pedido e botão "Ver meus pedidos".

---

## 3. Meus Pedidos

Acessível pelo menu do perfil do usuário (navbar). Mostra lista de pedidos do usuário logado.

### Lista de pedidos

Cada item exibe:
- Número do pedido (ID curto) e data
- Total e método de pagamento
- Badge de status com cor (pendente=amarelo, pago=azul, separando=roxo, enviado=laranja, entregue=verde, cancelado=vermelho)
- Botão para expandir

### Detalhe expandido

- Itens do pedido (imagem, nome, tamanho, quantidade, preço)
- Endereço de entrega
- NF-e (se preenchida pelo admin) — base para rastreio futuro

---

## 4. Server Functions

### `src/lib/checkout.functions.ts`

**`createOrder`** (POST, requer auth):
1. Valida carrinho (não vazio, estoque disponível)
2. Cria registro em `orders` e `order_items`
3. Chama API AbacatePay para criar cobrança (Pix ou Cartão)
4. Armazena `payment_id` no pedido
5. Retorna: QR code + payload Pix, ou resultado do cartão

**`getOrderStatus`** (GET, requer auth):
1. Busca status do pedido no banco
2. Retorna status atual (usado pelo polling do Pix)

### `src/lib/webhook.functions.ts`

**`abacatePayWebhook`** (POST, público):
1. Valida assinatura HMAC do AbacatePay (header `x-abacatepay-signature`)
2. Identifica pedido pelo `payment_id`
3. Atualiza `orders.status` para `pago`
4. Decrementa `estoque` em `product_variants` para cada item
5. Envia e-mail de confirmação ao cliente via Gmail SMTP

---

## 5. Painel Admin — Campo NF-e

No painel admin de pedidos, adicionar campo de texto para `nota_fiscal` ao atualizar o status de um pedido para `enviado`. Admin preenche a NF-e e salva junto com a mudança de status.

---

## 6. Variáveis de Ambiente

Adicionar no Vercel e no `.env` local:

```
ABACATEPAY_API_KEY=...
ABACATEPAY_WEBHOOK_SECRET=...
```

---

## Fora do Escopo (segunda fase)

- Rastreio integrado com Braspress, Atual Cargas, Troca Transporte e Rodonaves via NF-e
- Botão de rastreio na navbar (aguarda credenciais das transportadoras)
