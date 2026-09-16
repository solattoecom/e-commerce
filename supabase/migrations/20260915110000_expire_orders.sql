-- Habilita pg_cron (extensão nativa do Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Expira pedidos pendentes não pagos e restaura o estoque
CREATE OR REPLACE FUNCTION public.expire_pending_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item  RECORD;
BEGIN
  FOR v_order IN
    SELECT id
    FROM public.orders
    WHERE status = 'pendente'
      AND (
        (payment_method = 'pix'    AND criado_em < NOW() - INTERVAL '2 hours')
        OR
        (payment_method = 'boleto' AND criado_em < NOW() - INTERVAL '4 days')
        OR
        (payment_method = 'cartao' AND criado_em < NOW() - INTERVAL '1 hour')
      )
  LOOP
    UPDATE public.orders SET status = 'expirado' WHERE id = v_order.id;

    FOR v_item IN
      SELECT variacao_id, quantidade
      FROM public.order_items
      WHERE pedido_id = v_order.id
        AND variacao_id IS NOT NULL
    LOOP
      PERFORM public.restore_stock(v_item.variacao_id, v_item.quantidade);
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_pending_orders() TO service_role;

-- Agenda execução a cada 10 minutos
SELECT cron.schedule(
  'expire-pending-orders',
  '*/10 * * * *',
  $$SELECT public.expire_pending_orders()$$
);
