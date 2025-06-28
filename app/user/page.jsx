// app/user/page.jsx
// ────────────────────────────────────────────────────────────
// User dashboard (server component) – shows upcoming RSVP’d events
// in the neon VibeCalendar. Redirects to /login if the Supabase
// session cookie isn’t present.
//
// This version calls createSupabaseServer() from the project utilities
// (battle‑tested helper) and uses sb.auth.getUser() rather than
// getSession(), which in prior versions could return null even when
// the user cookie existed. That mismatch caused an unwanted redirect
// straight to /login.
//
// Any time‑zone conversion uses toZonedTime from date‑fns‑tz v3+.
// -------------------------------------------------------------------

import { createSupabaseServer } from "@/utils/supabase/server";
import { toZonedTime } from "date-fns-tz";
import { redirect } from "next/navigation";
import VibeCalendar from "@/components/VibeCalendar";

export const dynamic = "force-dynamic"; // disable Next.js caching

const TZ = "America/Denver"; // launch‑city default (Mountain Time)

export default async function UserDashboard() {
  /* 1 ─ establish server‑side Supabase client */
  const sb = await createSupabaseServer();

  /* 2 ─ auth gate: fetch user */
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (userErr || !user) {
    /* no cookie / invalid → bounce to login */
    redirect("/login");
  }

  /* 3 ─ grab this user’s RSVP’d event IDs */
  const { data: rsvpRows, error: rsvpErr } = await sb
    .from("rsvps")
    .select("event_id")
    .eq("user_id", user.id);

  if (rsvpErr) {
    throw new Error(rsvpErr.message);
  }

  const eventIds = (rsvpRows ?? []).map((r) => r.event_id);

  let events = [];
  if (eventIds.length) {
    /* 4 ─ pull upcoming, approved events matching those IDs */
    const { data, error } = await sb
      .from("events")
      .select("*")
      .in("id", eventIds)
      .gte("starts_at", new Date().toISOString())
      .eq("status", "approved")
      .order("starts_at", { ascending: true });

    if (error) throw new Error(error.message);

    events = data.map((ev) => ({
      ...ev,
      start: toZonedTime(new Date(ev.starts_at), TZ),
      end: toZonedTime(new Date(ev.ends_at), TZ),
      rsvpd: true,
    }));
  }

  /* 5 ─ render calendar */
  return (
    <div className="p-4">
      <VibeCalendar role="user" events={events} initialFilter="mine" />
    </div>
  );
}
