-- Restaura estoque automaticamente quando admin cancela um pedido pendente
CREATE OR REPLACE FUNCTION public.on_order_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF NEW.status = 'cancelado' AND OLD.status = 'pendente' THEN
    FOR v_item IN
      SELECT variacao_id, quantidade
      FROM public.order_items
      WHERE pedido_id = NEW.id
        AND variacao_id IS NOT NULL
    LOOP
      PERFORM public.restore_stock(v_item.variacao_id, v_item.quantidade);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_cancelled_restore_stock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.on_order_cancelled();
