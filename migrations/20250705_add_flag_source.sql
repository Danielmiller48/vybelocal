-- Add source column to flags table to track AI vs user flags
ALTER TABLE flags ADD COLUMN IF NOT EXISTS source VARCHAR(10) DEFAULT 'ai' CHECK (source IN ('ai', 'user'));

-- Update existing flags to have 'ai' as the default source (since they were created by AI/regex)
UPDATE flags SET source = 'ai' WHERE source IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE flags ALTER COLUMN source SET NOT NULL;

-- Add an index for efficient querying by source
CREATE INDEX IF NOT EXISTS idx_flags_source ON flags(source); 