-- migrations/20250816_grant_ai_reviews.sql
BEGIN;
GRANT INSERT ON ai_cancellation_reviews TO service_role;
COMMIT; 