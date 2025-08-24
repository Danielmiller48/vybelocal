//signup/route.js//
import { NextResponse } from 'next/server';
import sbAdmin          from '@/utils/supabase/admin';
import { sendVerify }   from '@/lib/twilio';

/* ───────── helper (unchanged) ───────── */
function parsePhone(raw) {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) throw new Error('bad_phone');
  return { db: digits, e164: `+1${digits}` };
}

export async function POST(req) {
  const { email, phone: rawPhone, password, name } = await req.json();
  if (!(email && rawPhone && password && name))
    return NextResponse.json('missing_fields', { status: 400 });

  /* ── 0 · normalise e-mail once ── */
  const emailNorm = email.trim().toLowerCase();

  /* ── 1 · duplicate-EMAIL guard (profiles) ── */
  const { data: emailDup } = await sbAdmin
    .from('profiles')
    .select('id')
    .eq('email', emailNorm)        // exact match
    .maybeSingle();

  console.log('[profiles.email] →', emailDup);             // ← DEBUG ①

  if (emailDup)
    return NextResponse.json('This email is already in use.', { status: 409 });

  /* ── 1b · duplicate-EMAIL guard (auth.users) ── */
  const { data: list, error: listErr } =
       await sbAdmin.auth.admin.listUsers({ email: emailNorm });
 console.log('[auth.users count] →', list?.users?.length);

 if (listErr) {
   console.error('[listUsers]', listErr);
   return NextResponse.json('server_error', { status: 500 });
 }
 const exactDup = list?.users?.find(
   u => u.email?.toLowerCase() === emailNorm
 );
 if (exactDup)
   return NextResponse.json('This email is already in use.', { status: 409 });

  /* ── 2 · parse + check phone (unchanged) ── */
  let phone;
  try { phone = parsePhone(rawPhone); }
  catch { return NextResponse.json('invalid_phone', { status: 400 }); }

  console.log('[profiles.phone check] →', phone.db);       // ← DEBUG ③

  const { data: dup } = await sbAdmin
    .from('profiles')
    .select('id')
    .eq('phone', phone.db)
    .maybeSingle();

  if (dup)
    return NextResponse.json('This phone number is already in use.', { status: 409 });

  // Moderation guard: block banned/suspended numbers before Twilio
  const { data: modProfile } = await sbAdmin
    .from('profiles')
    .select('is_permanently_banned, soft_ban_expires_at')
    .eq('phone', phone.db)
    .maybeSingle();

  if (modProfile?.is_permanently_banned) {
    return NextResponse.json('moderation: This phone number is permanently banned.', { status: 403 });
  }
  if (modProfile?.soft_ban_expires_at && new Date() < new Date(modProfile.soft_ban_expires_at)) {
    return NextResponse.json('moderation: This phone number is currently suspended.', { status: 403 });
  }

  /* ── 3 · send SMS only when BOTH guards have passed ── */
  try {
    await sendVerify(phone.e164);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Twilio', err);
    return NextResponse.json('sms_error', { status: 500 });
  }
}
