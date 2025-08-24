// app/api/phone/verify/route.js
import { NextResponse } from 'next/server';
import { checkVerify } from '@/lib/twilio';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function POST(req) {
  const { phone, code } = await req.json();
  if (!phone || !code) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const digits = String(phone).replace(/[^\d]/g,'');
  if (digits.length !== 10) return NextResponse.json({ error:'Invalid phone format'}, {status:400});
  const e164 = `+1${digits}`;

  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const res = await checkVerify(e164, code);
    if (res.status !== 'approved') {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }
    // duplicate check
    const { data: existing } = await sb.from('phone_numbers').select('profile_id').eq('phone', digits).maybeSingle();
    if (existing && existing.profile_id !== user.id) {
      return NextResponse.json({ error: 'Phone already linked to another account' }, { status: 400 });
    }

    // update profile
    const { error } = await sb.from('profiles').update({ phone: digits }).eq('id', user.id);
    if (error) throw error;

    // upsert mapping table
    await sb.from('phone_numbers').upsert({ phone: digits, profile_id: user.id });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('verify error', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
} 