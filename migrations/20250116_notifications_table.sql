-- Notifications table for intelligent notification management
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Notification content
  type VARCHAR(50) NOT NULL, -- 'chat_message', 'rsvp', 'event_reminder', etc.
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  
  -- Reference data  
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  related_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Who triggered this notification
  
  -- Smart batching data
  batch_key TEXT, -- Groups notifications for replacement (e.g., 'chat_123' for event 123)
  batch_count INTEGER DEFAULT 1, -- How many items in this batch
  contributor_ids JSONB DEFAULT '[]'::jsonb, -- Array of user IDs who contributed to this notification
  
  -- Metadata
  data JSONB DEFAULT '{}'::jsonb, -- Additional data for notification handling
  
  -- Status tracking
  is_read BOOLEAN DEFAULT FALSE,
  is_pushed BOOLEAN DEFAULT FALSE, -- Has push notification been sent
  push_response JSONB, -- Response from push notification service
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes for performance
  UNIQUE(user_id, batch_key) -- One notification per user per batch
);

-- Indexes
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_batch ON notifications(batch_key) WHERE batch_key IS NOT NULL;
CREATE INDEX idx_notifications_type_event ON notifications(type, event_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Functions for smart notification management

-- Function to upsert chat notifications with intelligent batching
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
BEGIN
  -- Create batch key for this event
  batch_key_val := 'chat_' || event_id::TEXT;
  
  -- Try to find existing notification for this user/event
  SELECT * INTO notification_record 
  FROM notifications 
  WHERE user_id = target_user_id 
    AND batch_key = batch_key_val 
    AND is_read = FALSE;
  
  IF notification_record.id IS NOT NULL THEN
    -- Update existing notification
    -- Add sender to contributors if not already there
    current_contributors := notification_record.contributor_ids;
    IF NOT current_contributors ? sender_id::TEXT THEN
      current_contributors := current_contributors || jsonb_build_array(sender_id);
    END IF;
    
    new_count := jsonb_array_length(current_contributors);
    
    UPDATE notifications SET
      body = CASE 
        WHEN new_count = 1 THEN sender_name || ': ' || LEFT(message_text, 50) || CASE WHEN LENGTH(message_text) > 50 THEN '...' ELSE '' END
        WHEN new_count = 2 THEN sender_name || ' and 1 other sent messages'
        ELSE sender_name || ' and ' || (new_count - 1)::TEXT || ' others sent messages'
      END,
      batch_count = new_count,
      contributor_ids = current_contributors,
      updated_at = NOW(),
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
    -- Create new notification
    INSERT INTO notifications (
      user_id,
      type,
      title,
      body,
      event_id,
      related_user_id,
      batch_key,
      batch_count,
      contributor_ids,
      data
    ) VALUES (
      target_user_id,
      'chat_message',
      event_title,
      sender_name || ': ' || LEFT(message_text, 50) || CASE WHEN LENGTH(message_text) > 50 THEN '...' ELSE '' END,
      event_id,
      sender_id,
      batch_key_val,
      1,
      jsonb_build_array(sender_id),
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

-- Function to mark event chat notifications as read
CREATE OR REPLACE FUNCTION mark_chat_notifications_read(
  target_user_id UUID,
  event_id UUID
) RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications SET
    is_read = TRUE,
    read_at = NOW()
  WHERE user_id = target_user_id
    AND batch_key = 'chat_' || event_id::TEXT
    AND is_read = FALSE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get unread notification counts by type
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
    n.event_id,
    COUNT(*)::INTEGER
  FROM notifications n
  WHERE n.user_id = target_user_id
    AND n.is_read = FALSE
  GROUP BY n.type, n.event_id;
END;
$$ LANGUAGE plpgsql; 