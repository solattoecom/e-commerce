# Cupons de Desconto — Design

**Data:** 2026-09-13  
**Projeto:** Solatto E-commerce

## Contexto

Adicionar suporte a cupons de desconto na loja Solatto. O campo de cupom aparece abaixo do calculador de frete no carrinho (sidebar) e na página de checkout.

## Requisitos

- Dois tipos de desconto: percentual (%) e valor fixo (R$)
- Cupons têm data de validade e/ou limite de usos (ambos opcionais)
- Desconto incide apenas sobre o subtotal dos produtos (não sobre o frete)
- Admin pode criar e desativar cupons pelo painel
- Validação sempre passa pelo servidor (sem lógica de cupom exposta no client)

## Banco de Dados

### Nova tabela: `coupons`

| Campo        | Tipo         | Descrição                                      |
|--------------|--------------|------------------------------------------------|
| `id`         | uuid PK      | Identificador                                  |
| `code`       | text unique  | Código do cupom (ex: SOLATTO10)                |
| `type`       | enum         | `percent` ou `fixed`                           |
| `value`      | numeric      | Valor do desconto (10 = 10% ou R$10,00)        |
| `expires_at` | timestamptz  | Data de expiração (nullable = sem validade)    |
| `max_uses`   | integer      | Limite de usos (nullable = ilimitado)          |
| `used_count` | integer      | Contador de usos, default 0                    |
| `active`     | boolean      | Permite desativação manual, default true       |

RLS: escrita apenas via `service_role`. Leitura pública negada — toda validação passa pelo servidor.

### Alteração: tabela `orders`

Nova coluna `coupon_id uuid references coupons(id)` (nullable) para rastrear qual cupom foi usado em cada pedido.

## Server Functions (`src/lib/coupon.functions.ts`)

### `validateCoupon({ code, subtotal })`

Chamada ao clicar "Aplicar" no componente de cupom.

1. Busca cupom pelo `code` (case-insensitive)
2. Valida: existe, `active = true`, não expirado, `used_count < max_uses` (se definido)
3. Calcula `discount_amount`:
   - `percent`: `subtotal * (value / 100)`
   - `fixed`: `min(value, subtotal)` — desconto não pode ser maior que o subtotal
4. Retorna `{ coupon_id, type, value, discount_amount }` ou lança erro descritivo

Mensagens de erro: `"Cupom inválido"`, `"Cupom expirado"`, `"Cupom esgotado"`, `"Cupom inativo"`.

### `applyOrderCoupon({ coupon_id, order_id })` (interna)

Chamada dentro de `checkout.functions.ts` ao criar o pedido.

1. Incrementa `used_count` em 1 atomicamente
2. Salva `coupon_id` no pedido

A validação ocorre duas vezes: ao digitar o código (UX) e ao finalizar o pedido (segurança), impedindo adulteração entre os dois momentos.

## Componente `CouponInput`

Arquivo: `src/components/CouponInput.tsx`

```ts
type DiscountResult = {
  coupon_id: string;
  type: "percent" | "fixed";
  value: number;
  discount_amount: number;
};

type Props = {
  subtotal: number;
  onApply: (discount: DiscountResult | null) => void;
};
```

**Estados visuais:**
- **Neutro:** campo de texto + botão "Aplicar" (desabilitado se vazio ou carregando)
- **Aplicado:** badge verde com código e valor do desconto + botão "Remover"
- **Erro:** mensagem em vermelho abaixo do campo

**Integração no total:**
O componente pai recalcula: `total = subtotal - discount_amount + frete.valor`

O componente é renderizado logo abaixo do `<ShippingCalculator>` em:
- `src/routes/index.tsx` (carrinho sidebar)
- `src/routes/_authenticated/checkout.tsx` (página de checkout)

## Admin Panel

Seção "Cupons" adicionada em `src/routes/_authenticated/admin.tsx`.

**Listagem:** tabela com código, tipo, valor, validade, usos (X/limite), status. Botão para ativar/desativar.

**Criação:** formulário com campos: código, tipo, valor, data de validade (opcional), limite de usos (opcional). Validação: código único, valor > 0.

Sem edição pós-criação — para corrigir um cupom, desativa e cria outro. Mantém histórico de uso limpo.

## Fluxo Completo

1. Usuário digita código → `validateCoupon` é chamada → desconto exibido
2. Usuário finaliza pedido → `createOrder` chama `applyOrderCoupon` internamente
3. `used_count` incrementa → cupom salvo no pedido

## Detalhes do Pedido (`pedidos.tsx`)

Na seção de totais de cada pedido expandido, exibir o cupom aplicado quando `coupon_id` estiver preenchido. A query do Supabase deve fazer join com `coupons` para trazer `code`, `type` e `value`. Exibição:

```
Subtotal          R$ 150,00
Cupom (SOLATTO10) - R$ 15,00
Frete             Grátis
Total             R$ 135,00
```

A linha do cupom aparece em verde, entre subtotal e frete, com o código entre parênteses e o valor do desconto negativo.

O tipo `Order` em `pedidos.tsx` precisa incluir:
```ts
coupon: { code: string; type: "percent" | "fixed"; value: number } | null;
desconto: number | null;
```

A coluna `desconto` é salva na tabela `orders` ao criar o pedido.

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/YYYYMMDD_coupons.sql` | Criar tabela `coupons`, coluna `coupon_id` e `desconto` em `orders` |
| `src/lib/coupon.functions.ts` | Criar (novo) |
| `src/components/CouponInput.tsx` | Criar (novo) |
| `src/routes/index.tsx` | Integrar `CouponInput` no carrinho |
| `src/routes/_authenticated/checkout.tsx` | Integrar `CouponInput` no checkout |
| `src/lib/checkout.functions.ts` | Chamar `applyOrderCoupon`, salvar `desconto` e incluir no total |
| `src/routes/_authenticated/pedidos.tsx` | Exibir cupom aplicado nos detalhes do pedido |
| `src/routes/_authenticated/admin.tsx` | Adicionar seção de cupons |
