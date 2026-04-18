-- Supplier branding bucket: logos and cover images shown in the public profile.
-- Path convention: {supplier_id}/{filename}
-- Bucket is public so <img src> resolves via public URL without a SELECT policy
-- on storage.objects (which would otherwise allow enumerating all files).
-- Write/update/delete are gated by `settings.manage` for the supplier segment.

INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-branding', 'supplier-branding', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "supplier_branding_write_settings_manage" ON storage.objects;
CREATE POLICY "supplier_branding_write_settings_manage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'supplier-branding'
    AND public.has_supplier_permission(
      (string_to_array(storage.objects.name, '/'))[1]::uuid,
      'settings.manage'
    )
  );

DROP POLICY IF EXISTS "supplier_branding_update_settings_manage" ON storage.objects;
CREATE POLICY "supplier_branding_update_settings_manage"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'supplier-branding'
    AND public.has_supplier_permission(
      (string_to_array(storage.objects.name, '/'))[1]::uuid,
      'settings.manage'
    )
  );

DROP POLICY IF EXISTS "supplier_branding_delete_settings_manage" ON storage.objects;
CREATE POLICY "supplier_branding_delete_settings_manage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'supplier-branding'
    AND public.has_supplier_permission(
      (string_to_array(storage.objects.name, '/'))[1]::uuid,
      'settings.manage'
    )
  );
