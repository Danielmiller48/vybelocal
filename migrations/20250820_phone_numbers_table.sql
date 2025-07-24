-- migrations/20250820_phone_numbers_table.sql
-- Table to track unique phone -> profile mapping (for duplicate check)
BEGIN;

CREATE TABLE IF NOT EXISTS phone_numbers (
  phone varchar(10) PRIMARY KEY, -- digits only, US numbers
  profile_id uuid UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  verified_at timestamptz DEFAULT now()
);

ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

-- profiles can see (and insert/update) their own row via service role only
CREATE POLICY phone_numbers_read_own ON phone_numbers
  FOR SELECT USING (auth.uid() = profile_id);

COMMIT; 