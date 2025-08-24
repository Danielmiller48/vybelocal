-- Migration: Add details column to flags table for AI moderation metadata
ALTER TABLE flags ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE flags ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'pending'; 