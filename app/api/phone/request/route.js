// app/api/phone/request/route.js
import { NextResponse } from 'next/server';
import { sendVerify } from '@/lib/twilio';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function POST(req) {
  const { phone } = await req.json();
  if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 });

  const digits = String(phone).replace(/[^\d]/g, '');
  if (digits.length !== 10) {
    return NextResponse.json({ error: 'Phone must be 10 digits (US). Use format XXX-XXX-XXXX.' }, { status: 400 });
  }
  const e164 = `+1${digits}`;

  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // if user already has this phone verified, no need to send code
  const { data: selfProfile } = await sb
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .single();
  if (selfProfile?.phone === digits) {
    return NextResponse.json({ unchanged: true });
  }

  // duplicate check against mapping table
  const { data: dupe } = await sb
    .from('phone_numbers')
    .select('profile_id')
    .eq('phone', digits)
    .maybeSingle();
  if (dupe && dupe.profile_id !== user.id) {
    return NextResponse.json({ error: 'Phone already linked to another account' }, { status: 400 });
  }

  // fallback check against profiles.phone for legacy rows
  const { count } = await sb
    .from('profiles')
    .select('*', { count:'exact', head:true })
    .eq('phone', digits)
    .neq('id', user.id);
  if ((count||0) > 0) {
    return NextResponse.json({ error: 'Phone already linked to another account' }, { status: 400 });
  }

  try {
    await sendVerify(e164);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Twilio sendVerify error', err);
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }
} 