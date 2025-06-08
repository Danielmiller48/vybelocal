// app/admin/dashboard/page.jsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams }  from "next/navigation";
import supabase             from "@/utils/supabase/browser";
import EventCard            from "@/components/EventCard";
import AdminStatusTabs      from "@/components/AdminStatusTabs";
import { decideEvent, deleteEvent, setEventStatus } from "./actions";

export default function EventQueue() {
  const search              = useSearchParams();
  const statusFilter        = search.get("status") ?? "pending";
  const [events, setEvents] = useState(null);  // null = loading
  const [isMutating, start] = useTransition();

  /* ─── fetch list whenever the filter changes ─── */
  useEffect(() => {
    setEvents(null);                         // loading indicator

    (async () => {
      const table = statusFilter === "history" ? "v_past_events" : "events";

      let query = supabase.from(table).select("*");

      if (statusFilter !== "history") {
        query = query.eq("status", statusFilter);
      }

      query = query.order(
        statusFilter === "history" ? "fallback_end" : "created_at",
        { ascending: false }
      );

      const { data, error } = await query;

      if (error) { console.error(error); setEvents([]); return; }

      const withThumbs = await Promise.all(
        (data || []).map(async (e) => {
          if (!e.img_path) return { ...e, thumb: null };
          if (e.img_path.startsWith("http")) return { ...e, thumb: e.img_path };
          const { data: url } = await supabase.storage
            .from("event-images")
            .createSignedUrl(e.img_path, 3600, {
              transform: { width: 320, height: 180, resize: "cover" },
            });
          return { ...e, thumb: url?.signedUrl ?? null };
        })
      );
      setEvents(withThumbs);
    })();
  }, [statusFilter]);

  /* ─── admin actions ─── */
  function handleDecide(id, approve) {
    setEvents(prev => prev?.filter(e => e.id !== id));
    start(() => decideEvent(id, approve));
  }

  function handlePending(id) {
    setEvents(prev => prev?.filter(e => e.id !== id));
    start(() => setEventStatus(id, "pending"));
  }

  function handleDelete(id) {
    setEvents(prev => prev?.filter(e => e.id !== id));
    start(() => deleteEvent(id));
  }

  /* ─── render ─── */
  return (
    <main className="p-6">
      <AdminStatusTabs />

      {events === null && <p>Loading…</p>}
      {events?.length === 0 && <p>No {statusFilter} events.</p>}

      {events && events.length > 0 && (
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {events.map((evt) => (
            <EventCard
              key={evt.id}
              event={evt}
              img={evt.thumb}

              /* Pending tab → Approve / Reject */
              {...(statusFilter === "pending" && {
                onApprove: () => handleDecide(evt.id, true),
                onDeny:    () => handleDecide(evt.id, false),
              })}

              /* Approved tab → Pending button */
              {...(statusFilter === "approved" && {
                onPending: () => handlePending(evt.id),
              })}

              /* Rejected tab → Pending + Delete */
              {...(statusFilter === "rejected" && {
                onPending: () => handlePending(evt.id),
                onDelete : () => handleDelete(evt.id),
              })}

              /* History tab → read-only, no link */
              {...(statusFilter === "history" && {
                noLink: true,
              })}

              disabled={isMutating}
            />
          ))}
        </section>
      )}
    </main>
  );
}
