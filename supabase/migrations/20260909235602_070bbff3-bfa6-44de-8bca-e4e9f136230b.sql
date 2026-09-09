CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variacao_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cart_items_unique_item ON public.cart_items (usuario_id, produto_id, COALESCE(variacao_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY cart_select_own ON public.cart_items FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY cart_insert_own ON public.cart_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY cart_update_own ON public.cart_items FOR UPDATE TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY cart_delete_own ON public.cart_items FOR DELETE TO authenticated USING (auth.uid() = usuario_id);

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();