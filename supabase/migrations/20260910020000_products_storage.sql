INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('products', 'products', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "products_storage_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'products');

CREATE POLICY "products_storage_admin_write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'products' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'products' AND public.has_role(auth.uid(), 'admin'::public.app_role));
