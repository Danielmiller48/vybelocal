// app/settings/payments/page.jsx
import { createSupabaseServer } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PaymentsReturn({ searchParams }) {
  const isReturn = 'return' in searchParams;
  const isRefresh= 'refresh' in searchParams;

  const sb = await createSupabaseServer();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) redirect('/login?next=/settings/payments');

  // ping status
  const res = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/stripe/connect/status`, {
    headers: { Cookie: '' }, // cookie passthrough not required in Next 15 SSR
    cache: 'no-store',
  });
  const status = await res.json();

  // If enabled, redirect back to settings root so modal shows green state
  if (status.enabled) {
    redirect('/');
  }

  return (
    <main className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">Stripe Onboarding</h1>
      {isReturn && (
        <p className="mb-4">Thanks! It looks like you completed the Stripe form.</p>
      )}
      {isRefresh && (
        <p className="mb-4">You left the Stripe flow. You can resume anytime.</p>
      )}
      <p>If this page doesn&apos;t redirect automatically, go back to Settings → Payments to check your status.</p>
    </main>
  );
} 