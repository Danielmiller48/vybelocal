// app/settings/payments/page.jsx
// -----------------------------------------------------------------------------
// After removing Stripe integration, this page simply explains that payouts are
// simulated in development. In production, a future Tilled setup flow will go
// here.
// -----------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/utils/supabase/server';
import PayoutsStateGate from '@/components/settings/PayoutsStateGate';

export const dynamic = 'force-dynamic';

export default async function PaymentsInfo() {
  const sb = await createSupabaseServer();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) redirect('/login?next=/settings/payments');

  // Fetch KYB status from waitlist backend
  let kyb = null;
  try {
    const token = session?.access_token;
    const url = `${process.env.NEXT_PUBLIC_WAITLIST_BASE_URL || 'https://vybelocal.com'}/api/payments/tilled/status`;
    const resp = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
    const txt = await resp.text();
    try { kyb = JSON.parse(txt); } catch { kyb = null; }
  } catch {}

  return (
    <main className="p-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold">Payouts</h1>
      <PayoutsStateGate data={kyb} />
    </main>
  );
} 