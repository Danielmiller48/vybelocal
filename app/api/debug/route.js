// app/api/debug/route.js  – delete after testing
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function GET() {
  const sb = await createSupabaseServer();          // ← await!

  // Make a trivial call that only succeeds with a valid key + cookies
  const { data: user, error } = await sb.auth.getUser();

  return NextResponse.json({ ok: !error, user });
}
