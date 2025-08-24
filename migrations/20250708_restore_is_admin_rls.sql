-- Restore admin RLS policies to use is_admin flag
-- Date: 2025-07-08

-- FLAGS TABLE
DROP POLICY IF EXISTS "Admins and service role can view all flags" ON public.flags;
DROP POLICY IF EXISTS "Admins can view all flags" ON public.flags;
DROP POLICY IF EXISTS "Flag mod read" ON public.flags;

CREATE POLICY "Admins can view all flags" ON public.flags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- PROFILES TABLE
DROP POLICY IF EXISTS "Admins and service role can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  );

-- EVENTS TABLE (if admin moderation is needed)
DROP POLICY IF EXISTS "Admins and service role can view all events" ON public.events;
DROP POLICY IF EXISTS "Admins can view all events" ON public.events;

CREATE POLICY "Admins can view all events" ON public.events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- RSVPS TABLE (if admin moderation is needed)
DROP POLICY IF EXISTS "Admins and service role can view all rsvps" ON public.rsvps;
DROP POLICY IF EXISTS "Admins can view all rsvps" ON public.rsvps;

CREATE POLICY "Admins can view all rsvps" ON public.rsvps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  ); 