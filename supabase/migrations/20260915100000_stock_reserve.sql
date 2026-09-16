-- Decrementa estoque atomicamente. Falha com exceção se estoque insuficiente.
CREATE OR REPLACE FUNCTION public.reserve_stock(p_variacao_id uuid, p_quantidade int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.product_variants
  SET estoque = estoque - p_quantidade
  WHERE id = p_variacao_id
    AND estoque >= p_quantidade;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'estoque_insuficiente' USING HINT = p_variacao_id::text;
  END IF;
END;
$$;

-- Restaura estoque (para cancelamentos e pedidos expirados)
CREATE OR REPLACE FUNCTION public.restore_stock(p_variacao_id uuid, p_quantidade int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.product_variants
  SET estoque = estoque + p_quantidade
  WHERE id = p_variacao_id;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_stock(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_stock(uuid, int) TO service_role;
