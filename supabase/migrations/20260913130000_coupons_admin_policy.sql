GRANT SELECT, INSERT, UPDATE ON public.coupons TO authenticated;

CREATE POLICY "coupons_admin_all" ON public.coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
