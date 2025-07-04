// app/api/supabase/set-cookies/route.js
import { NextResponse } from "next/server";

/**
 * Body shape expected from the bridge:
 *   { access_token: '...', refresh_token: '...' }
 */
export async function POST(request) {
  const { access_token, refresh_token } = await request.json();

  if (!access_token || !refresh_token) {
    return NextResponse.json(
      { error: "Missing tokens" },
      { status: 400 }
    );
  }

  /* ── write HTTP-only cookies ───────────────────────────── */
  const res = NextResponse.json({ ok: true });

  // 1 week max-age; tweak if you like
  const maxAge = 60 * 60 * 24 * 7;

  res.cookies.set("sb-access-token", access_token, {
    httpOnly: true,
    path: "/",
    maxAge,
    sameSite: "lax",
  });

  res.cookies.set("sb-refresh-token", refresh_token, {
    httpOnly: true,
    path: "/",
    maxAge,
    sameSite: "lax",
  });

  return res;
}
