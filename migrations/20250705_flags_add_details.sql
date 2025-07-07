-- Migration: Add details column to flags table for AI moderation metadata
ALTER TABLE flags ADD COLUMN IF NOT EXISTS details JSONB; 