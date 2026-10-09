-- Remove atacado values and add etiqueta_path column

-- 1. Limpa registros com tipo atacado
DELETE FROM public.product_prices WHERE tipo = 'atacado';
DELETE FROM public.user_client_types WHERE tipo = 'atacado';
DELETE FROM public.client_type_requests WHERE tipo_solicitado = 'atacado';

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

-- 5. Altera coluna product_prices.tipo
ALTER TABLE public.product_prices
  ALTER COLUMN tipo TYPE public.app_client_type_new
  USING tipo::text::public.app_client_type_new;

-- 6. Troca enums
DROP TYPE public.app_client_type;
ALTER TYPE public.app_client_type_new RENAME TO app_client_type;

-- 7. Recria função my_client_type() com o tipo atualizado
CREATE OR REPLACE FUNCTION public.my_client_type()
  RETURNS public.app_client_type
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tipo FROM public.user_client_types WHERE user_id = auth.uid()
$$;

-- 8. Adiciona coluna para path da etiqueta
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS etiqueta_path text;

-- 9. Cria bucket privado para etiquetas (idempotente)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('etiquetas', 'etiquetas', false)
  ON CONFLICT (id) DO NOTHING;

-- 10. Policy: admin pode ler etiquetas
DROP POLICY IF EXISTS "admin_select_etiquetas" ON storage.objects;
CREATE POLICY "admin_select_etiquetas" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'etiquetas'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );
