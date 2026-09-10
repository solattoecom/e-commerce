CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nota integer NOT NULL,
  comentario text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_id, user_id)
);

CREATE INDEX product_reviews_produto_idx ON public.product_reviews (produto_id);

GRANT SELECT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY reviews_public_read ON public.product_reviews
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY reviews_insert_own ON public.product_reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND nota BETWEEN 1 AND 5);

CREATE POLICY reviews_update_own ON public.product_reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND nota BETWEEN 1 AND 5);

CREATE POLICY reviews_delete_own ON public.product_reviews
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();