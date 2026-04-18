-- Harden supplier-branding bucket:
-- 1) enforce 5MB cap + image MIME allow-list on the bucket
-- 2) restore proper write/update/delete policies gated by settings.manage
--    (a prior debug session left INSERT permissive on bucket_id only)

UPDATE storage.buckets
   SET file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']
 WHERE id = 'supplier-branding';

DROP POLICY IF EXISTS "supplier_branding_write_settings_manage" ON storage.objects;
CREATE POLICY "supplier_branding_write_settings_manage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'supplier-branding'
    AND public.has_supplier_permission(
      (string_to_array(name, '/'))[1]::uuid,
      'settings.manage'
    )
  );

DROP POLICY IF EXISTS "supplier_branding_update_settings_manage" ON storage.objects;
CREATE POLICY "supplier_branding_update_settings_manage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'supplier-branding'
    AND public.has_supplier_permission(
      (string_to_array(name, '/'))[1]::uuid,
      'settings.manage'
    )
  )
  WITH CHECK (
    bucket_id = 'supplier-branding'
    AND public.has_supplier_permission(
      (string_to_array(name, '/'))[1]::uuid,
      'settings.manage'
    )
  );

DROP POLICY IF EXISTS "supplier_branding_delete_settings_manage" ON storage.objects;
CREATE POLICY "supplier_branding_delete_settings_manage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'supplier-branding'
    AND public.has_supplier_permission(
      (string_to_array(name, '/'))[1]::uuid,
      'settings.manage'
    )
  );
