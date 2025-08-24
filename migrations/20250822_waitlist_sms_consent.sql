-- Add SMS consent capture columns to waitlist table (idempotent)
-- Ensures we can document WEB checkbox opt-in with metadata for TFV

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'waitlist' AND column_name = 'sms_opt_in'
  ) THEN
    ALTER TABLE public.waitlist ADD COLUMN sms_opt_in boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'waitlist' AND column_name = 'sms_opt_in_method'
  ) THEN
    ALTER TABLE public.waitlist ADD COLUMN sms_opt_in_method text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'waitlist' AND column_name = 'sms_opt_in_ip'
  ) THEN
    ALTER TABLE public.waitlist ADD COLUMN sms_opt_in_ip text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'waitlist' AND column_name = 'sms_opt_in_useragent'
  ) THEN
    ALTER TABLE public.waitlist ADD COLUMN sms_opt_in_useragent text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'waitlist' AND column_name = 'sms_opt_in_at'
  ) THEN
    ALTER TABLE public.waitlist ADD COLUMN sms_opt_in_at timestamptz;
  END IF;
END $$;


