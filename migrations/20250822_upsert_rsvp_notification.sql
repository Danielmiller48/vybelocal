-- Batched RSVP notifications – one row per (user , event)
-- Title examples:
--   First RSVP:  "Alice RSVP’d to Beach Party!"
--   Later:       "Bob and 2 others RSVP’d to Beach Party!"
-- Body mirrors title for now.

CREATE OR REPLACE FUNCTION upsert_rsvp_notification(
  target_user_id UUID,
  event_id       UUID,
  event_title    TEXT,
  sender_id      UUID,
  sender_name    TEXT
) RETURNS notifications AS $$
DECLARE
  expiry_time   TIMESTAMPTZ := now() + interval '30 days'; -- RSVP notifications live longer
  batch_key_val TEXT        := 'rsvp_' || event_id::text;
  rec           notifications;
BEGIN
  -- Do not notify the sender themselves (skip host auto-RSVP)
  IF sender_id = target_user_id THEN
    RETURN NULL;
  END IF;
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
      'rsvp',
      INITCAP(sender_name) || ' RSVP’' || 'd to ' || event_title || '!',
      INITCAP(sender_name) || ' RSVP’' || 'd to ' || event_title || '!',
      batch_key_val,
      1,
      jsonb_build_array(sender_id),
      event_id,
      'events',
      expiry_time,
      FALSE,
      FALSE,
      jsonb_build_object(
        'latest_sender_id',   sender_id,
        'latest_sender_name', sender_name,
        'event_id',           event_id
      )
  )
  ON CONFLICT (user_id, batch_key)
  DO UPDATE
  SET
      batch_count     = notifications.batch_count + 1,
      contributor_ids = (
        SELECT jsonb_agg(DISTINCT elem)
        FROM   jsonb_array_elements(
                 notifications.contributor_ids || jsonb_build_array(sender_id)
               ) AS elem
      ),
      title = CASE WHEN notifications.batch_count + 1 = 1
               THEN INITCAP(sender_name) || ' RSVP’' || 'd to ' || event_title || '!'
               ELSE INITCAP(sender_name) || ' and ' || (notifications.batch_count)::text || ' others RSVP’' || 'd to ' || event_title || '!'
             END,
      message = title,
      created_at = now(),
      expires_at = expiry_time,
      is_pushed  = FALSE,
      data = jsonb_build_object(
               'latest_sender_id',   sender_id,
               'latest_sender_name', sender_name,
               'event_id',           event_id
             )
  RETURNING * INTO rec;
  RETURN rec;
END;
$$ LANGUAGE plpgsql; 