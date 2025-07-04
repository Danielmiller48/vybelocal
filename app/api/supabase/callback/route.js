// app/api/supabase/callback/route.js
import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import { createMiddlewareSupabaseClient } from "@supabase/auth-helpers-nextjs";

export async function POST(request) {
  // Parse { event, session } from the bridge
  const { event, session } = await request.json();

  // Bind the server-side Supabase helper to the current request
  const supabase = createMiddlewareSupabaseClient({ cookies });

  // This helper writes / clears the sb-* cookies
  await supabase.auth.setAuthCookie({
    event,    // 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED'
    session,  // may be null for SIGNED_OUT
  });

  return NextResponse.json({}, { status: 200 });
}
