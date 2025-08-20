-- Phase 4: Account Deletion System - DANGEROUS DELETION FUNCTIONS
-- ⚠️  WARNING: These functions can permanently delete user data
-- ⚠️  Only run this after testing phases 1-3 thoroughly

BEGIN;

-- DANGEROUS: Function to execute account deletion
CREATE OR REPLACE FUNCTION execute_account_deletion(deletion_request_id UUID)
RETURNS jsonb AS $$
DECLARE
  req account_deletion_requests%ROWTYPE;
  user_phone VARCHAR(10);
  deleted_counts jsonb := '{}'::jsonb;
  row_count INTEGER;
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
  
  -- Delete user data in order to avoid foreign key violations
  -- Each deletion is wrapped in a block to continue on errors
  
  BEGIN
    -- 1. Delete notifications
    DELETE FROM notifications WHERE user_id = req.user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts = jsonb_set(deleted_counts, '{notifications}', to_jsonb(row_count));
  EXCEPTION WHEN OTHERS THEN
    deleted_counts = jsonb_set(deleted_counts, '{notifications_error}', to_jsonb(SQLERRM));
  END;
  
  BEGIN
    -- 2. Delete blocks (as blocker)
    DELETE FROM blocks WHERE blocker_id = req.user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts = jsonb_set(deleted_counts, '{blocks}', to_jsonb(row_count));
  EXCEPTION WHEN OTHERS THEN
    deleted_counts = jsonb_set(deleted_counts, '{blocks_error}', to_jsonb(SQLERRM));
  END;
  
  BEGIN
    -- 3. Delete host follows (as follower and host)
    DELETE FROM host_follows WHERE follower_id = req.profile_id OR host_id = req.profile_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts = jsonb_set(deleted_counts, '{host_follows}', to_jsonb(row_count));
  EXCEPTION WHEN OTHERS THEN
    deleted_counts = jsonb_set(deleted_counts, '{host_follows_error}', to_jsonb(SQLERRM));
  END;
  
  BEGIN
    -- 4. Delete flags (as reporter and target)
    DELETE FROM flags WHERE reporter_id = req.profile_id OR user_id = req.profile_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts = jsonb_set(deleted_counts, '{flags}', to_jsonb(row_count));
  EXCEPTION WHEN OTHERS THEN
    deleted_counts = jsonb_set(deleted_counts, '{flags_error}', to_jsonb(SQLERRM));
  END;
  
  BEGIN
    -- 5. Delete RSVPs (will cascade to payments/ledger)
    DELETE FROM rsvps WHERE user_id = req.profile_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts = jsonb_set(deleted_counts, '{rsvps}', to_jsonb(row_count));
  EXCEPTION WHEN OTHERS THEN
    deleted_counts = jsonb_set(deleted_counts, '{rsvps_error}', to_jsonb(SQLERRM));
  END;
  
  BEGIN
    -- 6. Delete events (will cascade to related data)
    DELETE FROM events WHERE host_id = req.profile_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts = jsonb_set(deleted_counts, '{events}', to_jsonb(row_count));
  EXCEPTION WHEN OTHERS THEN
    deleted_counts = jsonb_set(deleted_counts, '{events_error}', to_jsonb(SQLERRM));
  END;
  
  BEGIN
    -- 7. Delete host cancel strikes (now preserved in phone_strikes)
    DELETE FROM host_cancel_strikes WHERE host_id = req.profile_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts = jsonb_set(deleted_counts, '{host_cancel_strikes}', to_jsonb(row_count));
  EXCEPTION WHEN OTHERS THEN
    deleted_counts = jsonb_set(deleted_counts, '{host_cancel_strikes_error}', to_jsonb(SQLERRM));
  END;
  
  BEGIN
    -- 8. Delete profile (will cascade to phone_numbers if exists)
    DELETE FROM profiles WHERE id = req.profile_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts = jsonb_set(deleted_counts, '{profiles}', to_jsonb(row_count));
  EXCEPTION WHEN OTHERS THEN
    deleted_counts = jsonb_set(deleted_counts, '{profiles_error}', to_jsonb(SQLERRM));
  END;
  
  BEGIN
    -- 9. Delete auth user (FINAL STEP)
    DELETE FROM auth.users WHERE id = req.user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts = jsonb_set(deleted_counts, '{auth_users}', to_jsonb(row_count));
  EXCEPTION WHEN OTHERS THEN
    deleted_counts = jsonb_set(deleted_counts, '{auth_users_error}', to_jsonb(SQLERRM));
  END;
  
  -- Mark deletion as completed
  UPDATE account_deletion_requests 
  SET status = 'completed' 
  WHERE id = deletion_request_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Account deletion executed',
    'strikes_preserved', user_phone IS NOT NULL,
    'deletion_details', deleted_counts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- DANGEROUS: Cleanup job function (processes pending deletions)
CREATE OR REPLACE FUNCTION process_pending_deletions()
RETURNS jsonb AS $$
DECLARE
  processed_count INTEGER := 0;
  req RECORD;
  deletion_result jsonb;
  results jsonb := '[]'::jsonb;
BEGIN
  -- Process all pending deletions that are due
  FOR req IN 
    SELECT id FROM account_deletion_requests 
    WHERE status = 'pending' AND scheduled_for <= NOW()
    LIMIT 10 -- Safety limit
  LOOP
    SELECT execute_account_deletion(req.id) INTO deletion_result;
    results := results || jsonb_build_array(deletion_result);
    processed_count := processed_count + 1;
  END LOOP;
  
  -- Cleanup old completed/cancelled requests (keep for 30 days)
  DELETE FROM account_deletion_requests 
  WHERE status IN ('completed', 'cancelled') 
    AND requested_at < (NOW() - INTERVAL '30 days');
  
  RETURN jsonb_build_object(
    'processed_deletions', processed_count,
    'results', results,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
