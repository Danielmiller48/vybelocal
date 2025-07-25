// app/settings/payments/page.jsx
// -----------------------------------------------------------------------------
// After removing Stripe integration, this page simply explains that payouts are
// simulated in development. In production, a future Tilled setup flow will go
// here.
// -----------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PaymentsInfo() {
  const sb = await createSupabaseServer();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) redirect('/login?next=/settings/payments');

  return (
    <main className="p-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold">Payouts</h1>
      <p>In this development build, payouts are simulated automatically when your event ends. No setup is required.</p>
      <p>When we integrate Tilled, this page will guide you through KYB onboarding.</p>
    </main>
  );
} 