// app/api/events/[id]/penalty-intent/route.js
// -----------------------------------------------------------------------------
// Simulated penalty payment – immediately returns succeeded status.
// -----------------------------------------------------------------------------

import { createSupabaseServer } from '@/utils/supabase/server';
import { getUserIdFromJwt } from '@/utils/auth';

export async function POST(req, ctx) {
  try {
    const hostId = await getUserIdFromJwt(req);
    if (!hostId) return new Response('unauth', { status: 401 });

    const eventId = ctx.params.id;
    const sb = await createSupabaseServer({ admin: true });

    // Here we could compute totals/strikes as before, but for simulation we skip
    // and just acknowledge payment success.

    // TODO: integrate penalty logic once real processor is in place.

    return Response.json({ status: 'succeeded' });
  } catch (err) {
    console.error('penalty-intent sim error', err);
    return new Response('server error', { status: 500 });
  }
} 