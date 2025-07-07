//verify/route.js//
import { NextResponse } from 'next/server';
import sbAdmin from '@/utils/supabase/admin';
import { checkVerify } from '@/lib/twilio';

export async function POST(request) {
  const { phone, code, email, password, name } = await request.json();
  if (!(phone && code && email && password && name)) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // 1 • SMS code check
  const ok = (await checkVerify(phone, code)).status === 'approved';
  if (!ok) {
    return NextResponse.json({ error: 'bad_code' }, { status: 401 });
  }

  // 2 • create user with service-role key
 const sb   = sbAdmin;
 const { data, error } = await sb.auth.admin.createUser({
   email,
   password,
   email_confirm: true,                 // phone-only signup
   user_metadata: { name, phone },
 });
 const userId = data?.user?.id;

  if (error) {
    console.error('createUser', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 3 • log verified phone (keeps history)
 const { error: phoneErr } = await sb
   .from('phone_numbers')
   .upsert({ phone, user_id: userId })

 // ignore "duplicate key value violates unique constraint" (code 23505)
 if (phoneErr && phoneErr.code !== '23505') {
   console.error('phone_numbers insert:', phoneErr);
   return NextResponse.json({ error: 'phone_insert_failed' }, { status: 400 });
 }

  // 4 • create profile
  const { error: profileErr } = await sb
    .from('profiles')
    .insert({
      id: userId,
      name: name,
      email: email,
      phone: phone.replace(/\D/g, ''), // Store as digits only
    });

  if (profileErr) {
    console.error('profile insert:', profileErr);
    return NextResponse.json({ error: 'profile_insert_failed' }, { status: 400 });
  }

  // 5 • trigger moderation for new user profile
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
