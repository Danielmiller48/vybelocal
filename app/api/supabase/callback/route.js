// app/api/supabase/callback/route.js
import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(request) {
  // Parse { event, session } from the bridge
  const { event, session } = await request.json();

  // Bind the server-side Supabase helper to the current request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookies().get(name)?.value,
        set: (name, value, options) => cookies().set(name, value, options),
        remove: (name, options) => cookies().delete(name, options),
      },
    }
  );

  // Handle the auth event
  if (event === 'SIGNED_IN') {
    await supabase.auth.setSession(session);
  } else if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut();
  }

  return NextResponse.json({}, { status: 200 });
}
