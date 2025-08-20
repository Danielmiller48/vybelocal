-- Phase 1: Account Deletion System - Safe Tables Only
-- Creates new tables without touching existing data

BEGIN;

-- 1. Create account deletion requests table (grace period)
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone VARCHAR(10), -- Store phone for strike persistence
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'completed')),
  
  UNIQUE(user_id) -- One deletion request per user
);

-- 2. Create phone-based strikes table (persists after account deletion)
CREATE TABLE IF NOT EXISTS phone_strikes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(10) NOT NULL,
  strike_type VARCHAR(50) NOT NULL, -- 'cancellation', 'violation', etc.
  event_id UUID, -- May reference deleted event
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Strikes can expire
  details JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for phone_strikes
CREATE INDEX IF NOT EXISTS idx_phone_strikes_phone ON phone_strikes(phone);
CREATE INDEX IF NOT EXISTS idx_phone_strikes_type ON phone_strikes(strike_type);
CREATE INDEX IF NOT EXISTS idx_phone_strikes_created ON phone_strikes(created_at);
CREATE INDEX IF NOT EXISTS idx_phone_strikes_phone_type ON phone_strikes(phone, strike_type, created_at);

-- Create indexes for account_deletion_requests
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user ON account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_scheduled ON account_deletion_requests(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON account_deletion_requests(status);

-- RLS Policies
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_strikes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own deletion requests
CREATE POLICY "Users can view own deletion requests" ON account_deletion_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own deletion requests  
CREATE POLICY "Users can create deletion requests" ON account_deletion_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own deletion requests (to cancel)
CREATE POLICY "Users can cancel deletion requests" ON account_deletion_requests
  FOR UPDATE USING (auth.uid() = user_id);

-- Phone strikes are read-only for users, managed by service role
CREATE POLICY "Service role manages phone strikes" ON phone_strikes
  FOR ALL USING (auth.role() = 'service_role');

COMMIT;
