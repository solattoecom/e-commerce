CREATE POLICY "products_storage_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'products');

CREATE POLICY "products_storage_admin_write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'products' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'products' AND public.has_role(auth.uid(), 'admin'::public.app_role));