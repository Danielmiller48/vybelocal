-- migrations/20250905_profiles_mcc_tax.sql
-- Add MCC and tax remit flag to profiles

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mcc text,
  ADD COLUMN IF NOT EXISTS tax_remit_required boolean;

-- Optional: index for filtering by tax remit flag
CREATE INDEX IF NOT EXISTS idx_profiles_tax_remit ON public.profiles(tax_remit_required);

COMMIT;




