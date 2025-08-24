-- migrations/20250817_add_mod_note_to_reviews.sql
-- Add moderator note column to cancellation reviews

BEGIN;

ALTER TABLE ai_cancellation_reviews
  ADD COLUMN IF NOT EXISTS mod_note text;

COMMIT; 