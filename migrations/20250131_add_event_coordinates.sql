-- migrations/20250131_add_event_coordinates.sql
-- Add latitude and longitude columns to events table for VybeMap

BEGIN;

-- Add coordinate columns for map functionality
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),  -- Precision for accurate coordinates
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8); -- Up to 180 degrees longitude

-- Create index for efficient spatial queries
CREATE INDEX IF NOT EXISTS idx_events_coordinates 
  ON events(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create index for map bounds queries (commonly used together)
CREATE INDEX IF NOT EXISTS idx_events_location_status 
  ON events(latitude, longitude, status, starts_at) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'approved';

COMMIT;