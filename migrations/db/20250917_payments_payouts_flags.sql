-- Add payouts_ok and default for bank_verification_status
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS payouts_ok boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Ensure bank_verification_status defaults to NULL (no action needed if already nullable)
-- Uncomment if a different default exists and needs to be cleared:
-- ALTER TABLE public.profiles ALTER COLUMN bank_verification_status DROP DEFAULT;

-- Optional: constrain allowed values if using enum-like text
-- COMMENT ON COLUMN public.profiles.bank_verification_status IS 'NULL|none|unverified|verified';


