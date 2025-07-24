-- migrations/20250812_rsvps_rls_cleanup.sql
-- Clean up RLS policies on public.rsvps
-- • Remove blanket SELECT that exposed all rows to any authenticated user
-- • Consolidate remaining SELECT policies so that:
--     • Row owner can read their own RSVP
--     • Event host can read RSVPs for their events
--     • Admins (profiles.is_admin) can read everything
-- All other INSERT/UPDATE/DELETE policies remain unchanged.

BEGIN;

/* 1️⃣ Drop the over-permissive policy */
DROP POLICY IF EXISTS "Authenticated users can view rsvps" ON public.rsvps;

/* 2️⃣ (Optional) Drop redundant rsvps_select to recreate in consolidated form */
DROP POLICY IF EXISTS "rsvps_select" ON public.rsvps;

/* 3️⃣ Recreate a single, clearer SELECT policy */
CREATE POLICY "rsvps_select" ON public.rsvps
  FOR SELECT USING (
    -- Row owner
    (user_id = auth.uid())
      OR
    -- Event host (owns the event tied to this RSVP)
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = rsvps.event_id
        AND events.host_id = auth.uid()
    )
      OR
    -- Admins (flag on profiles table)
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

COMMIT; 