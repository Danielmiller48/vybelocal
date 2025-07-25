// app/api/payouts/status/route.js
// -----------------------------------------------------------------------------
// Returns the host's payout configuration status. In simulation mode payouts are
// always enabled. This replaces the old /api/stripe/connect/status endpoint.
// -----------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { getUserIdFromJwt } from '@/utils/auth';

export async function GET(request) {
  const userId = await getUserIdFromJwt(request);
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  return NextResponse.json({ enabled: true, dashboard_url: null });
} 