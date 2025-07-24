// app/api/stripe/connect/onboard/route.js
import { NextResponse } from 'next/server';
import { stripe } from '@/utils/stripe/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function POST(req) {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile, error: profErr } = await sb
    .from('profiles')
    .select('stripe_account_id, email')
    .eq('id', user.id)
    .single();
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

  let acctId = profile.stripe_account_id;

  try {
    if (!acctId) {
      const acct = await stripe.accounts.create({
        type: 'express',
        email: profile.email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      });
      acctId = acct.id;
      const { error: updErr } = await sb.from('profiles').update({ stripe_account_id: acctId }).eq('id', user.id);
      if (updErr) {
        console.error('Failed to store stripe_account_id', updErr);
        return NextResponse.json({ error: 'Database policy blocked saving Stripe account. Contact support.' }, { status: 500 });
      }

      // sanity re-read
      const { data: verifyRow } = await sb.from('profiles').select('stripe_account_id').eq('id', user.id).single();
      if (!verifyRow?.stripe_account_id) {
        return NextResponse.json({ error: 'Could not save Stripe account ID; check RLS.' }, { status: 500 });
      }
    }

    const link = await stripe.accountLinks.create({
      account: acctId,
      type: 'account_onboarding',
      refresh_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings/payments?refresh=1`,
      return_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings/payments?return=1`,
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error('Stripe onboard error', err);
    return NextResponse.json({ error: 'Stripe error' }, { status: 500 });
  }
} 