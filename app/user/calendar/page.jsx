// ── app/user/calendar/page.jsx ──
// Moved from the old /app/user/page.jsx so the calendar now lives under
// /user/calendar. Logic is unchanged: fetch the current user's RSVP'd events
// and render <VibeCalendar />

import { createSupabaseServer } from "@/utils/supabase/server";
import { toZonedTime } from "date-fns-tz";
import { redirect } from "next/navigation";
import VibeCalendar from "@/components/user/VibeCalendar";

export const dynamic = "force-dynamic";
const TZ = "America/Denver";

export default async function UserCalendarPage() {
  const sb = await createSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

  const { data: rsvpRows } = await sb
    .from("rsvps")
    .select("event_id")
    .eq("user_id", user.id);

  const eventIds = (rsvpRows ?? []).map((r) => r.event_id);

  let events = [];
  if (eventIds.length) {
    const { data } = await sb
      .from("events")
      .select("*")
      .in("id", eventIds)
      .gte("starts_at", new Date().toISOString())
      .eq("status", "approved")
      .order("starts_at", { ascending: true });

    events = (data ?? []).map((ev) => ({
      ...ev,
      start: toZonedTime(new Date(ev.starts_at), TZ),
      end: toZonedTime(new Date(ev.ends_at), TZ),
      rsvpd: true,
    }));
  }

  return (
    <div className="p-4">
      <VibeCalendar role="user" events={events} initialFilter="mine" />
    </div>
  );
}
