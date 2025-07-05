import { NextResponse } from 'next/server';
import sbAdmin from '@/utils/supabase/admin';
import { sendVerify } from '@/lib/twilio';

export async function POST(request) {
  const { email, phone, password, name } = await request.json();
  if (!(email && phone && password && name)) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // 1 • block banned numbers
  const sb = sbAdmin; 
  const { data: blocked } = await sb
    .from('phone_blacklist')
    .select('phone')
    .eq('phone', phone);

  if (blocked.length) {
    return NextResponse.json({ error: 'phone_banned' }, { status: 403 });
  }

  // 2 • send SMS
  try {
    await sendVerify(phone);                // Twilio Verify
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Twilio sendVerify', err);
    return NextResponse.json({ error: 'sms_error' }, { status: 500 });
  }
}
