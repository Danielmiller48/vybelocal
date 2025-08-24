-- Migration: Add Trusted Host fields
-- Date: 2025-01-16
-- Description: Add is_trusted field to profiles table for trusted host badge system

-- Add trusted host fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trusted_since TIMESTAMP WITH TIME ZONE;

-- Create index for efficient querying of trusted hosts
CREATE INDEX IF NOT EXISTS idx_profiles_is_trusted ON public.profiles(is_trusted) WHERE is_trusted = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.is_trusted IS 'Indicates if this host has earned trusted status';
COMMENT ON COLUMN public.profiles.trusted_since IS 'Timestamp when the host was granted trusted status'; 