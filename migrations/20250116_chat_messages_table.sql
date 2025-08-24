-- Chat Messages Table (replaces Redis)
-- Simple, fast, and uses existing Supabase infrastructure

CREATE TABLE chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  message_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  -- Index for fast queries
  CONSTRAINT chat_messages_text_length CHECK (char_length(message_text) <= 500)
);

-- 🚀 PERFORMANCE INDEXES
CREATE INDEX idx_chat_messages_event_time ON chat_messages(event_id, created_at DESC);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);

-- 🧹 AUTO-CLEANUP: Delete messages 2 hours after event ends
-- This replaces Redis TTL functionality
CREATE OR REPLACE FUNCTION cleanup_chat_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM chat_messages 
  WHERE event_id IN (
    SELECT e.id 
    FROM events e 
    WHERE e.ends_at < (now() - INTERVAL '2 hours')
  );
END;
$$ LANGUAGE plpgsql;

-- 🔒 ROW LEVEL SECURITY
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages for events they're attending
CREATE POLICY "Users can read event chat messages" ON chat_messages
  FOR SELECT USING (
    event_id IN (
      SELECT event_id 
      FROM rsvps 
      WHERE user_id = auth.uid() 
      AND status = 'going'
    )
  );

-- Users can insert messages for events they're attending  
CREATE POLICY "Users can send chat messages" ON chat_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() 
    AND event_id IN (
      SELECT event_id 
      FROM rsvps 
      WHERE user_id = auth.uid() 
      AND status = 'going'
    )
  );

-- Enable realtime for instant updates (FREE with Supabase!)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages; 