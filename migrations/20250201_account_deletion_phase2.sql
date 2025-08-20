-- Phase 2: Account Deletion System - Safe Functions Only
-- Creates read-only and request functions without deletion capability

BEGIN;

-- 1. Function to check strikes for new registrations (READ-ONLY)
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

-- 2. Function to request account deletion (SAFE - just creates request)
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

-- 3. Function to cancel account deletion (SAFE - just updates request)
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

COMMIT;
