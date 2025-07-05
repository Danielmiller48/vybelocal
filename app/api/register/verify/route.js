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

  return NextResponse.json({ ok: true });
}
