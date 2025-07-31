-- Fix chat notification format to show proper titles and messages
-- Title should be "Name posted in Event" or "Name and X others posted in Event"
-- Message should be the actual chat message or message count

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
  notification_title TEXT;
  notification_message TEXT;
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
    
    -- Create proper title and message for multiple contributors
    IF new_count = 1 THEN
      notification_title := sender_name || ' posted in ' || event_title;
      notification_message := LEFT(message_text, 100) || CASE WHEN LENGTH(message_text) > 100 THEN '...' ELSE '' END;
    ELSIF new_count = 2 THEN
      notification_title := sender_name || ' and 1 other posted in ' || event_title;
      notification_message := new_count::TEXT || ' new messages';
    ELSE
      notification_title := sender_name || ' and ' || (new_count - 1)::TEXT || ' others posted in ' || event_title;
      notification_message := new_count::TEXT || ' new messages';
    END IF;
    
    UPDATE notifications SET
      title = notification_title,
      message = notification_message,
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
    -- Create new notification with proper format
    notification_title := sender_name || ' posted in ' || event_title;
    notification_message := LEFT(message_text, 100) || CASE WHEN LENGTH(message_text) > 100 THEN '...' ELSE '' END;
    
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
      notification_title,
      notification_message,
      batch_key_val,
      1,
      jsonb_build_array(sender_id),
      event_id,
      'events',
      expiry_time,
      FALSE,
      FALSE,
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