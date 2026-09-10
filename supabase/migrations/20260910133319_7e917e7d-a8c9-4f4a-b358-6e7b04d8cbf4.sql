-- Trigger that auto-creates profile + client type when a new auth user is inserted.
-- Runs as SECURITY DEFINER so it bypasses RLS — works with or without email confirmation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _tipo public.app_client_type;
BEGIN
  INSERT INTO public.profiles (id, nome, sobrenome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    COALESCE(NEW.raw_user_meta_data->>'sobrenome', ''),
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();