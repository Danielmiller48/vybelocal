-- Add auxiliary KYB fields to profiles
-- Safe, nullable columns for future use; existing flows unaffected

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_verification_status TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tilled_required JSONB;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.bank_verification_status IS 'Latest bank verification status from Tilled (nullable)';
COMMENT ON COLUMN public.profiles.tilled_required IS 'Last known required fields/requirements array/object from Tilled (nullable)';
COMMENT ON COLUMN public.profiles.last_webhook_at IS 'Timestamp of the most recent Tilled webhook processed for this user (nullable)';

COMMIT;




