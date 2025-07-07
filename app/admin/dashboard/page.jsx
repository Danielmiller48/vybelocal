// app/admin/dashboard/page.jsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams }  from "next/navigation";
import { createSupabaseBrowser }             from "@/utils/supabase/client";
import EventCard            from "@/components/event/EventCard";
import AdminStatusTabs      from "@/components/admin/AdminStatusTabs";
import {
  decideEvent,
  deleteEvent,
  setEventStatus,
  listEvents,          // ← server-action read helper
} from "./actions";

export default function EventQueue() {
  const search              = useSearchParams();
  const statusFilter        = search.get("status") ?? "pending";
  const [events, setEvents] = useState(null);  // null = loading
  const [isMutating, start] = useTransition();
  const supabase            = createSupabaseBrowser();

  /* ─── fetch list whenever the filter changes ─── */
  useEffect(() => {
    setEvents(null);                         // loading indicator

    (async () => {
      try {
        /* 1️⃣ pull raw rows with service-role (bypasses RLS) */
        const raw = await listEvents(statusFilter);

        /* 2️⃣ sign thumbnails client-side so URLs stay short-lived */
        const withThumbs = await Promise.all(
          raw.map(async (e) => {
            if (!e.img_path) return { ...e, thumb: null };
            if (e.img_path.startsWith("http")) return { ...e, thumb: e.img_path };
            const { data: url } = await supabase.storage
              .from("event-images")
              .createSignedUrl(e.img_path, 3600, {
                transform: { width: 320, height: 180, resize: "cover" },
              });
            return { ...e, thumb: url?.signedUrl ?? null };
          }),
        );

        setEvents(withThumbs);
      } catch (err) {
        console.error(err);
        setEvents([]);
      }
    })();
  }, [statusFilter]);

  /* ─── admin actions (unchanged) ─── */
  function handleDecide(id, approve) {
    setEvents((prev) => prev?.filter((e) => e.id !== id));
    start(() => decideEvent(id, approve));
  }

  function handlePending(id) {
    setEvents((prev) => prev?.filter((e) => e.id !== id));
    start(() => setEventStatus(id, "pending"));
  }

  function handleDelete(id) {
    setEvents((prev) => prev?.filter((e) => e.id !== id));
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
              { ...(statusFilter === "pending" && {
                onApprove: () => handleDecide(evt.id, true),
                onDeny   : () => handleDecide(evt.id, false),
              }) }

              /* Approved tab → Pending button */
              { ...(statusFilter === "approved" && {
                onPending: () => handlePending(evt.id),
              }) }

              /* Rejected tab → Pending + Delete */
              { ...(statusFilter === "rejected" && {
                onPending: () => handlePending(evt.id),
                onDelete : () => handleDelete(evt.id),
              }) }

              /* History tab → read-only, no link */
              { ...(statusFilter === "history" && { noLink: true }) }

              disabled={isMutating}
            />
          ))}
        </section>
      )}
    </main>
  );
}
