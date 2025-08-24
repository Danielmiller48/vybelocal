-- Lock down event-images bucket: set bucket to private (policies managed in Supabase UI/defaults)
-- Idempotent: safe to run multiple times

-- Ensure bucket is private (do not create here; assume it already exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'event-images') THEN
    UPDATE storage.buckets SET public = false WHERE name = 'event-images';
  END IF;
END $$;

-- Storage RLS/policies left unchanged; we rely on presigned upload and signed read URLs via server.


