-- Moov sandbox migration: add minimal fields to profiles for onboarding/status
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS moov_account_id text,
  ADD COLUMN IF NOT EXISTS moov_status text,
  ADD COLUMN IF NOT EXISTS moov_required jsonb,
  ADD COLUMN IF NOT EXISTS last_moov_webhook_at timestamptz;

-- Helpful index for status lookups
CREATE INDEX IF NOT EXISTS idx_profiles_moov_status ON public.profiles(moov_status);

COMMIT;




