-- migrations/20250115_add_payment_fields.sql
-- Add payment support to VybeLocal: events pricing, RSVP payment tracking, Stripe customer IDs

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. EVENTS: Add pricing field
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE events 
  ADD COLUMN price_in_cents INTEGER CHECK (price_in_cents >= 0);
  -- NULL = free event, positive integer = paid event in cents

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. RSVPS: Add payment tracking fields
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE rsvps 
  ADD COLUMN paid BOOLEAN DEFAULT true,                    -- existing RSVPs grandfathered as paid
  ADD COLUMN stripe_payment_id TEXT,                       -- payment_intent_id from Stripe
  ADD COLUMN stripe_receipt_url TEXT,                      -- receipt URL for email confirmations
  ADD COLUMN amount_paid INTEGER,                          -- actual amount paid in cents
  ADD COLUMN payment_date TIMESTAMP WITH TIME ZONE,       -- when payment was completed
  ADD COLUMN refund_requested BOOLEAN DEFAULT false,      -- manual refund tracking
  ADD COLUMN refund_reason TEXT;                           -- reason for refund request

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. PROFILES: Add Stripe customer ID for saved payment methods
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles 
  ADD COLUMN stripe_customer_id TEXT UNIQUE;              -- Stripe customer ID for saved cards

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. INDEXES: Performance and security
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_events_price ON events(price_in_cents) WHERE price_in_cents IS NOT NULL;
CREATE INDEX idx_rsvps_paid ON rsvps(paid);
CREATE INDEX idx_rsvps_stripe_payment_id ON rsvps(stripe_payment_id) WHERE stripe_payment_id IS NOT NULL;
CREATE INDEX idx_rsvps_payment_date ON rsvps(payment_date) WHERE payment_date IS NOT NULL;
CREATE INDEX idx_profiles_stripe_customer ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. CONSTRAINTS: Prevent grifting and ensure data integrity
-- ──────────────────────────────────────────────────────────────────────────────

-- Ensure payment fields are consistent
ALTER TABLE rsvps 
  ADD CONSTRAINT chk_payment_consistency 
  CHECK (
    (paid = false AND stripe_payment_id IS NULL AND amount_paid IS NULL AND payment_date IS NULL) OR
    (paid = true AND (stripe_payment_id IS NOT NULL OR amount_paid IS NULL)) -- allow grandfathered free RSVPs
  );

-- Ensure amount_paid matches positive values
ALTER TABLE rsvps 
  ADD CONSTRAINT chk_amount_paid_positive 
  CHECK (amount_paid IS NULL OR amount_paid > 0);

-- Ensure refund_reason only exists when refund_requested is true
ALTER TABLE rsvps 
  ADD CONSTRAINT chk_refund_reason_consistency 
  CHECK (
    (refund_requested = false AND refund_reason IS NULL) OR
    (refund_requested = true)
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. COMMENTS: Document the schema for future developers
-- ──────────────────────────────────────────────────────────────────────────────
COMMENT ON COLUMN events.price_in_cents IS 'Event price in cents. NULL = free event, positive integer = paid event';
COMMENT ON COLUMN rsvps.paid IS 'Whether RSVP payment is complete. Existing RSVPs default to true (grandfathered)';
COMMENT ON COLUMN rsvps.stripe_payment_id IS 'Stripe PaymentIntent ID for webhook verification';
COMMENT ON COLUMN rsvps.stripe_receipt_url IS 'Stripe receipt URL for email confirmations';
COMMENT ON COLUMN rsvps.amount_paid IS 'Actual amount paid in cents (may differ from event price due to promos)';
COMMENT ON COLUMN rsvps.payment_date IS 'Timestamp when payment was completed via webhook';
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe Customer ID for saved payment methods and faster checkout'; 