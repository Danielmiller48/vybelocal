-- migrations/20250905_payments_refunds_neutral.sql
-- Processor-neutral payments + refunds schema (non-PII). Adds columns to existing payments if present.

BEGIN;

-- 1) Ensure payments table exists (processor-neutral). If an older version exists, extend it.
CREATE TABLE IF NOT EXISTS public.payments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id                  uuid NOT NULL REFERENCES public.rsvps(id) ON DELETE CASCADE,
  processor                text NOT NULL DEFAULT 'tilled',
  processor_payment_id     text NOT NULL UNIQUE,
  amount_cents             integer NOT NULL CHECK (amount_cents > 0),
  currency                 text NOT NULL DEFAULT 'usd',
  status                   text NOT NULL DEFAULT 'succeeded',
  receipt_url              text,
  paid_at                  timestamptz DEFAULT now(),
  refunded                 boolean NOT NULL DEFAULT false,
  refund_amount_cents      integer NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Back-compat: if legacy stripe_payment_id exists, add processor columns and populate neutral id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'processor_payment_id'
  ) THEN
    ALTER TABLE public.payments
      ADD COLUMN processor text NOT NULL DEFAULT 'tilled',
      ADD COLUMN processor_payment_id text,
      ADD COLUMN amount_cents integer,
      ADD COLUMN currency text NOT NULL DEFAULT 'usd',
      ADD COLUMN status text NOT NULL DEFAULT 'succeeded',
      ADD COLUMN refund_amount_cents integer NOT NULL DEFAULT 0,
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

    UPDATE public.payments
      SET processor_payment_id = COALESCE(processor_payment_id, stripe_payment_id)
      WHERE processor_payment_id IS NULL;

    ALTER TABLE public.payments
      ALTER COLUMN processor_payment_id SET NOT NULL;

    -- Unique on neutral id if not already present
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='payments' AND indexname='payments_processor_payment_id_key'
    ) THEN
      ALTER TABLE public.payments ADD CONSTRAINT payments_processor_payment_id_key UNIQUE (processor_payment_id);
    END IF;
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_payments_rsvp ON public.payments(rsvp_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_payments_refunded ON public.payments(refunded);

-- 2) Refunds table (one row per processor-issued refund). Non-PII.
CREATE TABLE IF NOT EXISTS public.refunds (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id              uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  processor               text NOT NULL DEFAULT 'tilled',
  processor_refund_id     text NOT NULL UNIQUE,
  amount_cents            integer NOT NULL CHECK (amount_cents > 0),
  reason                  text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON public.refunds(payment_id);

-- 3) RLS: enable and allow read for owner of RSVP; service role bypasses.
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='payments_owner_select'
  ) THEN
    CREATE POLICY payments_owner_select ON public.payments
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.rsvps r
          WHERE r.id = payments.rsvp_id AND r.user_id = auth.uid()
        )
      );
  END IF;
END $$;

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='refunds' AND policyname='refunds_owner_select'
  ) THEN
    CREATE POLICY refunds_owner_select ON public.refunds
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.payments p
          JOIN public.rsvps r ON r.id = p.rsvp_id
          WHERE p.id = refunds.payment_id AND r.user_id = auth.uid()
        )
      );
  END IF;
END $$;

COMMIT;




