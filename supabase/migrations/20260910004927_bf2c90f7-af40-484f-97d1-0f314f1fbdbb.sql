-- Solicitações de tipo de conta (atacado / dropshipping)
CREATE TABLE public.client_type_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo_solicitado public.app_client_type NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  criado_em timestamptz NOT NULL DEFAULT now(),
  decidido_em timestamptz,
  CONSTRAINT client_type_requests_status_check CHECK (status IN ('pendente','aprovado','recusado'))
);

CREATE UNIQUE INDEX client_type_requests_one_pending
  ON public.client_type_requests (user_id)
  WHERE status = 'pendente';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_type_requests TO authenticated;
GRANT ALL ON public.client_type_requests TO service_role;

ALTER TABLE public.client_type_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY requests_insert_own ON public.client_type_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pendente');

CREATE POLICY requests_select_own ON public.client_type_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY requests_admin_manage ON public.client_type_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin precisa enxergar os clientes para avaliar solicitações e pedidos
CREATE POLICY profiles_admin_read_all ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY client_types_admin_read_all ON public.user_client_types
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));