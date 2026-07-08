CREATE POLICY "public read car-media" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'car-media');
CREATE POLICY "editors upload car-media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'car-media' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')));
CREATE POLICY "editors update car-media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'car-media' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')));
CREATE POLICY "editors delete car-media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'car-media' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')));