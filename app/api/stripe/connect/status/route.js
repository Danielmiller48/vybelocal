// app/api/stripe/connect/status/route.js
import { NextResponse } from 'next/server';
import { stripe } from '@/utils/stripe/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function GET() {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_account_id')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_account_id) {
    return NextResponse.json({ enabled:false });
  }

  try {
    const acct = await stripe.accounts.retrieve(profile.stripe_account_id);
    const enabled = acct.charges_enabled && acct.payouts_enabled;
    const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);
    return NextResponse.json({ enabled, dashboard_url: loginLink.url });
  } catch (err) {
    console.error('Stripe status error', err);
    return NextResponse.json({ error: 'Stripe error' }, { status: 500 });
  }
} 