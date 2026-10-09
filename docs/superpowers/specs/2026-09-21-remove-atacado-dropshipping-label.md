# Remoção do Atacado + Etiqueta Dropshipping

## Objetivo

Remover o tipo de cliente "atacado" do sistema e implementar upload de etiqueta de frete no checkout para clientes dropshipping.

## Escopo

### 1. Remoção do Atacado

Remover todas as referências a `atacado`, `atacado_presencial` e `atacado_distancia` de:
- `useAuth.ts` — tipo `ClientType`
- `shipping.functions.ts` — union type e lógica condicional
- `checkout.functions.ts` — union type
- `AdminProdutos.tsx` — array `TIPOS_PRECO`, estados e formulário de preços
- `admin.tsx` — textos e lógica de aprovação
- `checkout.tsx` — estado e tipo local
- `entrar.tsx`, `sobre.tsx`, `termos.tsx` — textos informativos
- `types.ts` (Supabase generated) — enum `app_client_type`
- Migrations SQL — enum e comentários

Após remoção, `ClientType = "varejo" | "dropshipping"`.

### 2. Lógica de Frete

- **Varejo**: continua usando Melhor Envio normalmente.
- **Dropshipping**: sem cotação de frete. Frete = R$ 0,00. Cliente faz upload da própria etiqueta.

A condição atual `if (clientTipo !== "atacado")` passa a ser `if (clientTipo !== "dropshipping")`.

### 3. Upload de Etiqueta no Checkout (Dropshipping)

**Fluxo:**
1. No checkout, se `clientTipo === "dropshipping"`, exibir campo de upload (PDF ou imagem).
2. O arquivo fica em memória/estado React até confirmação do pedido.
3. Após pagamento confirmado, fazer upload para Supabase Storage (bucket `etiquetas`) e salvar o path na coluna `etiqueta_path` da tabela `orders`.
4. Se pagamento não for confirmado, arquivo é descartado (sem lixo no Storage).

**Razão de manter em memória até confirmação:** pagamentos síncronos (cartão) resolvem na mesma sessão. Para PIX/boleto (async), o arquivo precisa ser enviado junto com o pedido; nesse caso, o upload acontece ao criar o pedido com status `pendente`, e o path fica salvo.

**Bucket:** `etiquetas` (privado). Path: `{order_id}/etiqueta.{ext}`.

### 4. Painel Admin — Download da Etiqueta

Na lista/detalhe de pedidos em `admin.tsx`, se o pedido tiver `etiqueta_path`, exibir botão "Baixar Etiqueta" que gera URL assinada via Supabase Storage e faz download.

## Banco de Dados

Alterações necessárias:
1. Remover `atacado`, `atacado_presencial`, `atacado_distancia` do enum `app_client_type`.
2. Adicionar coluna `etiqueta_path text` na tabela `orders`.
3. Criar bucket `etiquetas` no Supabase Storage (privado).
4. Policy de Storage: admin pode fazer SELECT; service role pode INSERT.

## Arquivos Afetados

| Arquivo | Tipo de mudança |
|---|---|
| `src/hooks/useAuth.ts` | Remover `atacado` do union type |
| `src/lib/shipping.functions.ts` | Remover union type atacado; ajustar condição de frete |
| `src/lib/checkout.functions.ts` | Remover union type atacado |
| `src/components/AdminProdutos.tsx` | Remover `atacado` de `TIPOS_PRECO` e estados |
| `src/routes/_authenticated/admin.tsx` | Remover textos e lógica de atacado; add download etiqueta |
| `src/routes/_authenticated/checkout.tsx` | Remover atacado; add upload etiqueta para dropshipping |
| `src/routes/entrar.tsx` | Remover atacado de textos |
| `src/routes/index.tsx` | Remover atacado de textos |
| `src/routes/sobre.tsx` | Remover atacado de textos |
| `src/routes/termos.tsx` | Remover atacado de textos |
| `src/integrations/supabase/types.ts` | Atualizar enum gerado |
| `supabase/migrations/` | Nova migration: enum + coluna + bucket |
