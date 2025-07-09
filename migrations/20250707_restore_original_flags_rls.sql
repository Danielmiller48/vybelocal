-- Restore original RLS policies for public.flags
-- Date: 2025-07-07

-- Remove all current policies
DROP POLICY IF EXISTS "Admins and service role can view all flags" ON public.flags;
DROP POLICY IF EXISTS "Admins can view all flags" ON public.flags;
DROP POLICY IF EXISTS "Flag mod read" ON public.flags;
DROP POLICY IF EXISTS "Flag self read" ON public.flags;
DROP POLICY IF EXISTS "Flag insert" ON public.flags;
DROP POLICY IF EXISTS "Allow update for reporter or admin" ON public.flags;
DROP POLICY IF EXISTS "Users can delete their own flags" ON public.flags;

-- Restore original SELECT policy: reporter or admin
CREATE POLICY "Flag self read" ON public.flags
  FOR SELECT USING (
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- Restore original INSERT policy: only allow reporter to insert
CREATE POLICY "Flag insert" ON public.flags
  FOR INSERT WITH CHECK (
    reporter_id = auth.uid()
  );

-- Restore original UPDATE policy: only allow reporter or admin to update
CREATE POLICY "Allow update for reporter or admin" ON public.flags
  FOR UPDATE USING (
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- Restore original DELETE policy: only allow reporter to delete
CREATE POLICY "Users can delete their own flags" ON public.flags
  FOR DELETE USING (
    reporter_id = auth.uid()
  ); 