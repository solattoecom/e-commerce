CREATE TABLE public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tamanho text NOT NULL,
  nome text NOT NULL,
  email text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_id, tamanho, email)
);

GRANT SELECT, INSERT, DELETE ON public.stock_alerts TO anon, authenticated;
GRANT ALL ON public.stock_alerts TO service_role;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_alerts_insert" ON public.stock_alerts
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "stock_alerts_service" ON public.stock_alerts
  FOR ALL TO service_role USING (true);
