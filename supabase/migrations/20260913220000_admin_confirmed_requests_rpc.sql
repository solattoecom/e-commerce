-- RPC para admin: retorna solicitações apenas de usuários com e-mail confirmado.
CREATE OR REPLACE FUNCTION public.get_confirmed_client_type_requests()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  tipo_solicitado text,
  status text,
  criado_em timestamptz,
  nome text,
  sobrenome text,
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
    p.sobrenome,
    p.email
  FROM public.client_type_requests r
  JOIN public.profiles p ON p.id = r.user_id
  JOIN auth.users u ON u.id = r.user_id
  WHERE u.email_confirmed_at IS NOT NULL
  ORDER BY r.criado_em DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_confirmed_client_type_requests() TO authenticated;
