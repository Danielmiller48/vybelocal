-- migrations/20250816_ai_cancellation_reviews.sql
BEGIN;

CREATE TABLE IF NOT EXISTS ai_cancellation_reviews (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                 uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  host_id                  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason_text              text,
  ai_strike_recommendation boolean,
  confidence_score         numeric,
  reviewed_by              uuid REFERENCES profiles(id),
  moderator_override       boolean DEFAULT false,
  final_strike_applied     boolean DEFAULT false,
  created_at               timestamptz DEFAULT now()
);

ALTER TABLE ai_cancellation_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY read_own_reviews ON ai_cancellation_reviews
  FOR SELECT USING (host_id = auth.uid());

COMMIT; 