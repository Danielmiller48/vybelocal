-- Create host_follows table for tracking which users follow which hosts
CREATE TABLE IF NOT EXISTS host_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only follow a host once
  UNIQUE(follower_id, host_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_host_follows_follower_id ON host_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_host_follows_host_id ON host_follows(host_id);
CREATE INDEX IF NOT EXISTS idx_host_follows_created_at ON host_follows(created_at DESC);

-- Add RLS policies
ALTER TABLE host_follows ENABLE ROW LEVEL SECURITY;

-- Users can read their own follows and follows of hosts they can see
CREATE POLICY "Users can read relevant follows" ON host_follows
  FOR SELECT
  USING (
    auth.uid() = follower_id OR 
    auth.uid() = host_id OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = host_id 
      AND profiles.id IS NOT NULL
    )
  );

-- Users can insert their own follows
CREATE POLICY "Users can follow hosts" ON host_follows
  FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Users can delete their own follows
CREATE POLICY "Users can unfollow hosts" ON host_follows
  FOR DELETE
  USING (auth.uid() = follower_id);

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_host_follows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_host_follows_updated_at_trigger
  BEFORE UPDATE ON host_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_host_follows_updated_at();


