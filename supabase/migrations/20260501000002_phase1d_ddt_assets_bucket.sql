-- Phase 1D — DDT template assets bucket (logos) with RLS.
-- Refs: docs/superpowers/plans/2026-04-15-supplier-fase1d-ddt-consegne-dashboard.md (Task 10)
-- Path convention: {supplier_id}/{filename}
-- Bucket is public-read so the logo can be embedded inside React-PDF `<Image>` without
-- requiring signed URLs; write/update/delete are restricted to members with
-- `ddt.manage_templates` permission on the supplier segment of the object key.

INSERT INTO storage.buckets (id, name, public)
VALUES ('ddt-assets', 'ddt-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ddt_assets_public_read" ON storage.objects;
CREATE POLICY "ddt_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ddt-assets');

DROP POLICY IF EXISTS "ddt_assets_write_manage_templates" ON storage.objects;
CREATE POLICY "ddt_assets_write_manage_templates"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ddt-assets'
    AND public.has_supplier_permission(
      (string_to_array(storage.objects.name, '/'))[1]::uuid,
      'ddt.manage_templates'
    )
  );

DROP POLICY IF EXISTS "ddt_assets_update_manage_templates" ON storage.objects;
CREATE POLICY "ddt_assets_update_manage_templates"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'ddt-assets'
    AND public.has_supplier_permission(
      (string_to_array(storage.objects.name, '/'))[1]::uuid,
      'ddt.manage_templates'
    )
  );

DROP POLICY IF EXISTS "ddt_assets_delete_manage_templates" ON storage.objects;
CREATE POLICY "ddt_assets_delete_manage_templates"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ddt-assets'
    AND public.has_supplier_permission(
      (string_to_array(storage.objects.name, '/'))[1]::uuid,
      'ddt.manage_templates'
    )
  );
