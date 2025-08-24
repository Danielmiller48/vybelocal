-- migrations/20250804_payments_table.sql
-- Switch to dedicated payments table and clean up RSVP columns

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Clean up RSVPS: keep only basic paid flag; remove Stripe-specific fields
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE rsvps
  DROP COLUMN IF EXISTS stripe_payment_id,
  DROP COLUMN IF EXISTS stripe_receipt_url,
  DROP COLUMN IF EXISTS amount_paid,
  DROP COLUMN IF EXISTS payment_date,
  DROP COLUMN IF EXISTS refund_requested,
  DROP COLUMN IF EXISTS refund_reason;

-- Ensure simple paid flag exists (for legacy DBs)
ALTER TABLE rsvps
  ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PAYMENTS table – one row per successful payment (for now)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id            uuid NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
  stripe_payment_id  text UNIQUE,               -- PaymentIntent ID
  amount_paid        integer NOT NULL CHECK (amount_paid > 0),
  receipt_url        text,
  paid_at            timestamptz DEFAULT now(),
  refunded           boolean DEFAULT false,
  refund_reason      text,
  created_at         timestamptz DEFAULT now()
);

-- one-to-one for now (can relax later)
ALTER TABLE payments
  ADD CONSTRAINT payments_rsvp_unique UNIQUE (rsvp_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Indexes to speed up queries
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_rsvp     ON payments(rsvp_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at  ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_payments_refunded ON payments(refunded);

COMMIT; 