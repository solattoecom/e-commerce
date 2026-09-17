-- Replace nome + sobrenome with a single full-name field (nome).
-- Merges existing data into nome, then drops sobrenome.

UPDATE public.profiles
SET nome = TRIM(nome || CASE WHEN sobrenome != '' THEN ' ' || sobrenome ELSE '' END)
WHERE sobrenome IS NOT NULL AND sobrenome != '';

ALTER TABLE public.profiles DROP COLUMN IF EXISTS sobrenome;

-- Update trigger to use full name (nome) instead of separate fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _tipo public.app_client_type;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_client_types (user_id, tipo)
  VALUES (NEW.id, 'varejo')
  ON CONFLICT (user_id) DO NOTHING;

  BEGIN
    _tipo := (NEW.raw_user_meta_data->>'tipo')::public.app_client_type;
  EXCEPTION WHEN invalid_text_representation THEN
    _tipo := NULL;
  END;

  IF _tipo IS NOT NULL AND _tipo != 'varejo' THEN
    INSERT INTO public.client_type_requests (user_id, tipo_solicitado, status)
    VALUES (NEW.id, _tipo, 'pendente')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Update admin RPC to remove sobrenome
CREATE OR REPLACE FUNCTION public.get_confirmed_client_type_requests()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  tipo_solicitado text,
  status text,
  criado_em timestamptz,
  nome text,
  email text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.user_id,
    r.tipo_solicitado::text,
    r.status::text,
    r.criado_em,
    p.nome,
    p.email
  FROM public.client_type_requests r
  JOIN public.profiles p ON p.id = r.user_id
  JOIN auth.users u ON u.id = r.user_id
  WHERE u.email_confirmed_at IS NOT NULL
  ORDER BY r.criado_em DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_confirmed_client_type_requests() TO authenticated;
