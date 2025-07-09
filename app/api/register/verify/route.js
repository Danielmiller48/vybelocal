//verify/route.js//
import { NextResponse } from 'next/server';
import sbAdmin from '@/utils/supabase/admin';
import { checkVerify } from '@/lib/twilio';

// Re-use the same phone parser logic as in signup
function parsePhone(raw) {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) throw new Error('bad_phone');
  return { db: digits, e164: `+1${digits}` };
}

export async function POST(request) {
  const { phone: rawPhone, code, email, password, name } = await request.json();
  if (!(rawPhone && code && email && password && name)) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  /* 1 · normalise phone once */
  let phone;
  try { phone = parsePhone(rawPhone); }
  catch { return NextResponse.json({ error: 'invalid_phone' }, { status: 400 }); }

  // 2 • SMS code check (always use E.164)
  const ok = (await checkVerify(phone.e164, code)).status === 'approved';
  if (!ok) {
    return NextResponse.json({ error: 'bad_code' }, { status: 401 });
  }

  // 3 • create user with service-role key
  const sb = sbAdmin;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone: phone.db },
  });
  const userId = data?.user?.id;

  if (error) {
    console.error('createUser', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 4 • log verified phone (keeps history)
  const { error: phoneErr } = await sb
    .from('phone_numbers')
    .upsert({ phone: phone.db, user_id: userId });

  if (phoneErr && phoneErr.code !== '23505') {
    console.error('phone_numbers insert:', phoneErr);
    return NextResponse.json({ error: 'phone_insert_failed' }, { status: 400 });
  }

  // 5 • upsert profile (idempotent)
  const { error: profileErr } = await sb
    .from('profiles')
    .upsert({
      id: userId,
      name: name,
      email: email.trim().toLowerCase(),
      phone: phone.db,
    });

  if (profileErr) {
    console.error('profile upsert:', profileErr);
    return NextResponse.json({ error: 'profile_upsert_failed' }, { status: 400 });
  }

  // 6 • trigger moderation for new user profile
  try {
    console.log('Triggering moderation for new user profile:', userId);
    const modResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3003'}/api/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'user', id: userId }),
    });
    
    if (!modResponse.ok) {
      const modError = await modResponse.json();
      console.error('Profile moderation failed:', modError);
      // Don't fail registration, just log the error
      console.log('User registered but moderation failed:', modError.reason);
    } else {
      console.log('Profile moderation triggered successfully');
    }
  } catch (modError) {
    console.error('Profile moderation error:', modError);
    // Don't fail registration, just log the error
  }

  return NextResponse.json({ ok: true });
}
