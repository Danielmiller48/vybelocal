-- Phase 3: Account Deletion System - Add Column to Existing Table
-- CAUTION: This modifies existing host_cancel_strikes table

BEGIN;

-- Add phone column to existing table (SAFE - nullable column)
ALTER TABLE host_cancel_strikes 
ADD COLUMN IF NOT EXISTS phone VARCHAR(10);

-- Create index for new column
CREATE INDEX IF NOT EXISTS idx_host_cancel_strikes_phone ON host_cancel_strikes(phone);

-- Function to migrate existing strikes to phone-based system (SAFE - read-only migration)
CREATE OR REPLACE FUNCTION migrate_strikes_to_phone()
RETURNS jsonb AS $$
DECLARE
  updated_count INTEGER := 0;
  migrated_count INTEGER := 0;
BEGIN
  -- Update host_cancel_strikes to include phone numbers
  UPDATE host_cancel_strikes 
  SET phone = profiles.phone
  FROM profiles 
  WHERE host_cancel_strikes.host_id = profiles.id 
    AND host_cancel_strikes.phone IS NULL
    AND profiles.phone IS NOT NULL;
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
    
  -- Copy to phone_strikes table for persistence
  INSERT INTO phone_strikes (phone, strike_type, event_id, created_at, details)
  SELECT 
    phone,
    'cancellation' as strike_type,
    event_id,
    canceled_at as created_at,
    jsonb_build_object(
      'migrated_from', 'host_cancel_strikes', 
      'original_host_id', host_id,
      'migration_date', NOW()
    ) as details
  FROM host_cancel_strikes 
  WHERE phone IS NOT NULL
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_strikes', updated_count,
    'migrated_strikes', migrated_count,
    'message', format('Updated %s strikes with phone numbers, migrated %s to phone_strikes table', updated_count, migrated_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
