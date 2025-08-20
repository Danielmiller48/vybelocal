-- Account Deletion System with Phone-Based Strike Persistence
-- Implements 1-hour grace period and preserves strikes tied to phone numbers

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

-- 2. Modify host_cancel_strikes to include phone for persistence
ALTER TABLE host_cancel_strikes 
ADD COLUMN IF NOT EXISTS phone VARCHAR(10);

-- 3. Create phone-based strikes table (persists after account deletion)
CREATE TABLE IF NOT EXISTS phone_strikes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(10) NOT NULL,
  strike_type VARCHAR(50) NOT NULL, -- 'cancellation', 'violation', etc.
  event_id UUID, -- May reference deleted event
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Strikes can expire
  details JSONB DEFAULT '{}'::jsonb,
  
  INDEX(phone, strike_type, created_at)
);

-- 4. Function to migrate existing strikes to phone-based system
CREATE OR REPLACE FUNCTION migrate_strikes_to_phone()
RETURNS void AS $$
BEGIN
  -- Migrate host_cancel_strikes to include phone numbers
  UPDATE host_cancel_strikes 
  SET phone = profiles.phone
  FROM profiles 
  WHERE host_cancel_strikes.host_id = profiles.id 
    AND host_cancel_strikes.phone IS NULL
    AND profiles.phone IS NOT NULL;
    
  -- Copy to phone_strikes table for persistence
  INSERT INTO phone_strikes (phone, strike_type, event_id, created_at, details)
  SELECT 
    phone,
    'cancellation' as strike_type,
    event_id,
    canceled_at as created_at,
    jsonb_build_object('migrated_from', 'host_cancel_strikes', 'original_host_id', host_id) as details
  FROM host_cancel_strikes 
  WHERE phone IS NOT NULL
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to request account deletion
CREATE OR REPLACE FUNCTION request_account_deletion(user_uuid UUID)
RETURNS jsonb AS $$
DECLARE
  user_profile profiles%ROWTYPE;
  deletion_id UUID;
BEGIN
  -- Get user profile info
  SELECT * INTO user_profile FROM profiles WHERE id = user_uuid;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  
  -- Create deletion request
  INSERT INTO account_deletion_requests (user_id, profile_id, phone)
  VALUES (user_uuid, user_profile.id, user_profile.phone)
  RETURNING id INTO deletion_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'deletion_id', deletion_id,
    'scheduled_for', (NOW() + INTERVAL '1 hour')::text,
    'message', 'Account deletion scheduled for 1 hour from now. You can cancel this request.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to cancel account deletion
CREATE OR REPLACE FUNCTION cancel_account_deletion(user_uuid UUID)
RETURNS jsonb AS $$
BEGIN
  UPDATE account_deletion_requests 
  SET status = 'cancelled'
  WHERE user_id = user_uuid AND status = 'pending';
  
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'Account deletion cancelled');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'No pending deletion request found');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to execute account deletion
CREATE OR REPLACE FUNCTION execute_account_deletion(deletion_request_id UUID)
RETURNS jsonb AS $$
DECLARE
  req account_deletion_requests%ROWTYPE;
  user_phone VARCHAR(10);
BEGIN
  -- Get deletion request
  SELECT * INTO req FROM account_deletion_requests WHERE id = deletion_request_id;
  
  IF NOT FOUND OR req.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid deletion request');
  END IF;
  
  -- Store phone for strike migration
  user_phone := req.phone;
  
  -- Migrate strikes to phone-based system before deletion
  IF user_phone IS NOT NULL THEN
    INSERT INTO phone_strikes (phone, strike_type, created_at, details)
    SELECT 
      user_phone,
      'cancellation',
      canceled_at,
      jsonb_build_object('deleted_account', true, 'profile_id', req.profile_id)
    FROM host_cancel_strikes 
    WHERE host_id = req.profile_id
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Delete user data (CASCADE will handle most relationships)
  -- Order matters to avoid foreign key violations
  
  -- 1. Delete notifications
  DELETE FROM notifications WHERE user_id = req.user_id;
  
  -- 2. Delete blocks (as blocker)
  DELETE FROM blocks WHERE blocker_id = req.user_id;
  
  -- 3. Delete host follows (as follower and host)
  DELETE FROM host_follows WHERE follower_id = req.profile_id OR host_id = req.profile_id;
  
  -- 4. Delete flags (as reporter and target)
  DELETE FROM flags WHERE reporter_id = req.profile_id OR user_id = req.profile_id;
  
  -- 5. Delete RSVPs (will cascade to payments/ledger)
  DELETE FROM rsvps WHERE user_id = req.profile_id;
  
  -- 6. Delete events (will cascade to related data)
  DELETE FROM events WHERE host_id = req.profile_id;
  
  -- 7. Delete host cancel strikes (now preserved in phone_strikes)
  DELETE FROM host_cancel_strikes WHERE host_id = req.profile_id;
  
  -- 8. Delete profile (will cascade to phone_numbers if exists)
  DELETE FROM profiles WHERE id = req.profile_id;
  
  -- 9. Delete auth user
  DELETE FROM auth.users WHERE id = req.user_id;
  
  -- Mark deletion as completed
  UPDATE account_deletion_requests 
  SET status = 'completed' 
  WHERE id = deletion_request_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Account successfully deleted',
    'strikes_preserved', user_phone IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to check strikes for new registrations
CREATE OR REPLACE FUNCTION get_phone_strikes(phone_number VARCHAR(10))
RETURNS jsonb AS $$
DECLARE
  strike_count INTEGER;
  active_strikes jsonb;
BEGIN
  -- Count active strikes
  SELECT COUNT(*) INTO strike_count
  FROM phone_strikes 
  WHERE phone = phone_number 
    AND (expires_at IS NULL OR expires_at > NOW());
  
  -- Get strike details
  SELECT jsonb_agg(
    jsonb_build_object(
      'type', strike_type,
      'created_at', created_at,
      'expires_at', expires_at,
      'details', details
    )
  ) INTO active_strikes
  FROM phone_strikes 
  WHERE phone = phone_number 
    AND (expires_at IS NULL OR expires_at > NOW());
  
  RETURN jsonb_build_object(
    'phone', phone_number,
    'strike_count', strike_count,
    'strikes', COALESCE(active_strikes, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Cleanup job function (run periodically)
CREATE OR REPLACE FUNCTION process_pending_deletions()
RETURNS jsonb AS $$
DECLARE
  processed_count INTEGER := 0;
  req RECORD;
BEGIN
  -- Process all pending deletions that are due
  FOR req IN 
    SELECT id FROM account_deletion_requests 
    WHERE status = 'pending' AND scheduled_for <= NOW()
  LOOP
    PERFORM execute_account_deletion(req.id);
    processed_count := processed_count + 1;
  END LOOP;
  
  -- Cleanup old completed/cancelled requests (keep for 30 days)
  DELETE FROM account_deletion_requests 
  WHERE status IN ('completed', 'cancelled') 
    AND requested_at < (NOW() - INTERVAL '30 days');
  
  RETURN jsonb_build_object(
    'processed_deletions', processed_count,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RLS Policies
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
