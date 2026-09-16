-- supabase/migrations/20260916120000_me_columns.sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS me_service_id integer,
  ADD COLUMN IF NOT EXISTS me_order_id text;

COMMENT ON COLUMN public.orders.me_service_id IS 'ID numérico do serviço Melhor Envio escolhido pelo cliente. Null para atacado/fallback.';
COMMENT ON COLUMN public.orders.me_order_id IS 'ID do pedido no Melhor Envio após geração da etiqueta. Usado para tracking e PDF.';
