-- Remove atacado values and add etiqueta_path column

-- 1. Limpa registros com tipos atacado
DELETE FROM public.user_client_types
  WHERE tipo IN ('atacado', 'atacado_presencial', 'atacado_distancia');

DELETE FROM public.client_type_requests
  WHERE tipo_solicitado IN ('atacado', 'atacado_presencial', 'atacado_distancia');

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

-- 5. Troca enums
DROP TYPE public.app_client_type;
ALTER TYPE public.app_client_type_new RENAME TO app_client_type;

-- 6. Adiciona coluna para path da etiqueta
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS etiqueta_path text;

-- 7. Cria bucket privado para etiquetas (idempotente)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('etiquetas', 'etiquetas', false)
  ON CONFLICT (id) DO NOTHING;

-- 8. Policy: admin pode ler etiquetas
CREATE POLICY "admin_select_etiquetas" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'etiquetas'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
