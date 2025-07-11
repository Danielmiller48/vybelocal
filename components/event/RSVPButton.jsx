"use client";

import { useState, useEffect, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/utils/supabase/client";
import toast from "react-hot-toast";

const supabase = createSupabaseBrowser();

export default function RSVPButton({ eventId }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [joined, setJoined] = useState(false);
  const [busy, startBusy] = useTransition();
  const [bridged, setBridged] = useState(false);
  const [rsvpCount, setRsvpCount] = useState(0);
  const [capacity, setCapacity] = useState(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    const sync = async () => {
      const at = session?.supabase?.access_token || session?.supabaseAccessToken;
      const rt = session?.supabase?.refresh_token || session?.supabaseRefreshToken;

      if (at && rt) {
        await supabase.auth
          .setSession({ access_token: at, refresh_token: rt })
          .catch(() => {});
      }
      setBridged(true);
    };

    sync();
  }, [status, session]);

  useEffect(() => {
    async function fetchJoined() {
      if (status !== "authenticated") return;
      console.log("RSVPButton: Fetching user RSVP status for event:", eventId, "user:", session.user.id);
      const { data, error } = await supabase
        .from("rsvps")
        .select("user_id")
        .eq("event_id", eventId)
        .eq("user_id", session.user.id);
      
      if (error) {
        console.error("RSVPButton: Error fetching user RSVP status:", error);
      } else {
        console.log("RSVPButton: User RSVP status fetched:", data);
        if (data?.length) setJoined(true);
      }
    }
    fetchJoined();
  }, [status, session, eventId]);

  useEffect(() => {
    async function fetchEventData() {
      if (!bridged) return;
      
      console.log("RSVPButton: Fetching event data for:", eventId);
      
      // Fetch event capacity
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("rsvp_capacity")
        .eq("id", eventId)
        .single();
      
      if (eventError) {
        console.error("RSVPButton: Error fetching event capacity:", eventError);
      } else {
        console.log("RSVPButton: Event capacity fetched:", event?.rsvp_capacity);
        setCapacity(event?.rsvp_capacity || null);
      }

      // Fetch RSVP count
      const { count, error: countError } = await supabase
        .from("rsvps")
        .select("event_id", { count: "exact" })
        .eq("event_id", eventId);
      
      if (countError) {
        console.error("RSVPButton: Error fetching RSVP count:", countError);
      } else {
        console.log("RSVPButton: RSVP count fetched:", count);
        setRsvpCount(count ?? 0);
      }
    }
    fetchEventData();
  }, [bridged, eventId]);

  function toggleRsvp() {
    if (!bridged) return;
    if (status !== "authenticated") {
      router.push("/login");
      return;
    }

    // Check capacity before allowing RSVP
    if (!joined && capacity && rsvpCount >= capacity) {
      toast.error("This event is at maximum capacity.");
      return;
    }

    startBusy(async () => {
      const row = { event_id: eventId, user_id: session.user.id };
      let error;

      if (!joined) {
        ({ error } = await supabase
          .from("rsvps")
          .insert(row, { ignoreDuplicates: true }));
        if (!error) {
          setJoined(true);
          setRsvpCount(rsvpCount + 1);
          toast.success("RSVP confirmed! 🎉");
        }
      } else {
        if (!confirm("Are you sure you want to cancel your RSVP?")) return;
        ({ error } = await supabase.from("rsvps").delete().match(row));
        if (!error) {
          setJoined(false);
          setRsvpCount(rsvpCount - 1);
          toast("RSVP cancelled.");
        }
      }

      if (error) {
        toast.error("Something went wrong.");
        console.error(error.message);
      }
    });
  }

  return (
    <button
      onClick={toggleRsvp}
      disabled={busy || !bridged || (!joined && capacity && rsvpCount >= capacity)}
      className={`mt-4 w-full rounded-lg py-2 text-white transition ${
        joined ? "bg-gray-500 hover:bg-gray-600" : "bg-indigo-600 hover:bg-indigo-700"
      } ${(!joined && capacity && rsvpCount >= capacity) ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {busy 
        ? "…" 
        : joined 
          ? "Cancel RSVP" 
          : (!joined && capacity && rsvpCount >= capacity)
            ? "Max capacity reached"
            : capacity 
              ? `RSVP (${Math.max(0, capacity - rsvpCount)} left)`
              : "RSVP"
      }
    </button>
  );
}
