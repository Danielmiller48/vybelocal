-- Update existing notifications table for intelligent chat notifications
-- Add missing columns while preserving existing schema

-- EXISTING COLUMNS (keeping as-is):
-- id, user_id, title, message, created_at, expires_at, is_dismissed, reference_id, reference_table

-- ADD ONLY NEW COLUMNS NEEDED FOR CHAT BATCHING:
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'rsvp';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS batch_key TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS batch_count INTEGER DEFAULT 1;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS contributor_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_pushed BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- Add event_id if not already covered by reference_id + reference_table = 'events'
-- (We'll use reference_id for event_id when reference_table = 'events')

-- Add indexes for performance (using existing columns)
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_batch ON notifications(batch_key) WHERE batch_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_id, reference_table);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE is_dismissed = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Add unique constraint for batching (one notification per user per batch)
-- Handle potential conflicts gracefully
DO $$ 
BEGIN
    ALTER TABLE notifications ADD CONSTRAINT unique_user_batch UNIQUE(user_id, batch_key);
EXCEPTION 
    WHEN duplicate_table THEN 
        -- Constraint already exists, skip
        NULL;
END $$;

-- Function to upsert chat notifications with intelligent batching
-- Uses existing schema: title, message, is_dismissed, reference_id, reference_table, expires_at
CREATE OR REPLACE FUNCTION upsert_chat_notification(
  target_user_id UUID,
  event_id UUID,
  event_title TEXT,
  sender_id UUID,
  sender_name TEXT,
  message_text TEXT
) RETURNS notifications AS $$
DECLARE
  notification_record notifications;
  batch_key_val TEXT;
  current_contributors JSONB;
  new_count INTEGER;
  expiry_time TIMESTAMPTZ;
BEGIN
  -- Create batch key for this event
  batch_key_val := 'chat_' || event_id::TEXT;
  
  -- Set expiry to 7 days from now
  expiry_time := NOW() + INTERVAL '7 days';
  
  -- Try to find existing notification for this user/event
  SELECT * INTO notification_record 
  FROM notifications 
  WHERE user_id = target_user_id 
    AND batch_key = batch_key_val 
    AND is_dismissed = FALSE
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF notification_record.id IS NOT NULL THEN
    -- Update existing notification
    -- Add sender to contributors if not already there
    current_contributors := COALESCE(notification_record.contributor_ids, '[]'::jsonb);
    IF NOT current_contributors ? sender_id::TEXT THEN
      current_contributors := current_contributors || jsonb_build_array(sender_id);
    END IF;
    
    new_count := jsonb_array_length(current_contributors);
    
    UPDATE notifications SET
      title = event_title,
      message = CASE 
        WHEN new_count = 1 THEN sender_name || ': ' || LEFT(message_text, 50) || CASE WHEN LENGTH(message_text) > 50 THEN '...' ELSE '' END
        WHEN new_count = 2 THEN sender_name || ' and 1 other sent messages'
        ELSE sender_name || ' and ' || (new_count - 1)::TEXT || ' others sent messages'
      END,
      batch_count = new_count,
      contributor_ids = current_contributors,
      created_at = NOW(), -- Update timestamp for latest activity
      expires_at = expiry_time,
      is_pushed = FALSE, -- Mark for re-push
      data = jsonb_build_object(
        'latest_sender_id', sender_id,
        'latest_sender_name', sender_name,
        'latest_message', message_text,
        'event_id', event_id
      )
    WHERE id = notification_record.id
    RETURNING * INTO notification_record;
  ELSE
    -- Create new notification using existing schema
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      batch_key,
      batch_count,
      contributor_ids,
      reference_id,
      reference_table,
      expires_at,
      is_dismissed,
      is_pushed,
      data
    ) VALUES (
      target_user_id,
      'chat_message',
      event_title,
      sender_name || ': ' || LEFT(message_text, 50) || CASE WHEN LENGTH(message_text) > 50 THEN '...' ELSE '' END,
      batch_key_val,
      1,
      jsonb_build_array(sender_id),
      event_id, -- Use existing reference_id field
      'events', -- Use existing reference_table field
      expiry_time,
      FALSE, -- Use existing is_dismissed field
      FALSE, -- Mark as not pushed yet
      jsonb_build_object(
        'latest_sender_id', sender_id,
        'latest_sender_name', sender_name,
        'latest_message', message_text,
        'event_id', event_id
      )
    ) RETURNING * INTO notification_record;
  END IF;
  
  RETURN notification_record;
END;
$$ LANGUAGE plpgsql;

-- Function to mark event chat notifications as read (using existing schema)
CREATE OR REPLACE FUNCTION mark_chat_notifications_read(
  target_user_id UUID,
  event_id UUID
) RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications SET
    is_dismissed = TRUE -- Use existing is_dismissed field
  WHERE user_id = target_user_id
    AND batch_key = 'chat_' || event_id::TEXT
    AND is_dismissed = FALSE
    AND (expires_at IS NULL OR expires_at > NOW());
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get unread notification counts by type (using existing schema)
CREATE OR REPLACE FUNCTION get_user_unread_counts(
  target_user_id UUID
) RETURNS TABLE(
  type TEXT,
  event_id UUID,
  count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.type::TEXT,
    n.reference_id AS event_id, -- Use existing reference_id field
    COUNT(*)::INTEGER
  FROM notifications n
  WHERE n.user_id = target_user_id
    AND n.is_dismissed = FALSE
    AND (n.expires_at IS NULL OR n.expires_at > NOW())
    AND n.reference_table = 'events' -- Only count event-related notifications
  GROUP BY n.type, n.reference_id;
END;
$$ LANGUAGE plpgsql; 