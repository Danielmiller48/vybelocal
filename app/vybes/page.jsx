// app/vybes/page.jsx
import { supabase as getSupabase } from "@/utils/supabase/server";
import { signedUrl }               from "@/utils/signedUrl";
import EventCard                   from "@/components/EventCard";

const BUCKET        = "event-images";
const TTL_SECONDS   = 60 * 60;
const THUMB_OPTIONS = { width: 320, height: 180, resize: "cover" };

export const revalidate = 60;   // ISR — refresh every minute

export default async function VybesPage() {
  const sb = await getSupabase();

  /* 1. fetch events already filtered to status='approved' */
  const { data: events, error } = await sb
    .from("public_events")
    .select("*")
    .order("starts_at", { ascending: true });

  if (error) throw new Error(error.message);

  /* 2. attach signed thumbnail URLs */
  const cards = await Promise.all(
    events.map(async (e) => ({
      ...e,
      thumb: await signedUrl( BUCKET, e.img_path, TTL_SECONDS, THUMB_OPTIONS),
    }))
  );

  /* 3. render grid */
  return (
    <main className="p-6">
      {cards.length === 0 ? (
        <p>No approved events yet—be the first to host!</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
          {cards.map((c) => (
            <EventCard key={c.id} event={c} img={c.thumb} />
          ))}
        </div>
      )}
    </main>
  );
}
