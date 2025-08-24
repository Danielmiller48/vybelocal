-- migrations/20250807_ledger_table.sql
-- Adds revenue ledger table to track platform income per payment

BEGIN;

CREATE TABLE IF NOT EXISTS ledger (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id         uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  vybe_fee_cents     integer NOT NULL,
  stripe_fee_cents   integer NOT NULL,
  net_cents          integer NOT NULL,
  created_at         timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_payment ON ledger(payment_id);

COMMIT; 