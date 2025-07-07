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
      const { data } = await supabase
        .from("rsvps")
        .select("user_id")
        .eq("event_id", eventId)
        .eq("user_id", session.user.id);
      if (data?.length) setJoined(true);
    }
    fetchJoined();
  }, [status, session, eventId]);

  function toggleRsvp() {
    if (!bridged) return;
    if (status !== "authenticated") {
      router.push("/login");
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
          toast.success("RSVP confirmed! 🎉");
        }
      } else {
        ({ error } = await supabase.from("rsvps").delete().match(row));
        if (!error) {
          setJoined(false);
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
      disabled={busy || !bridged}
      className={`mt-4 w-full rounded-lg py-2 text-white transition ${
        joined ? "bg-gray-500 hover:bg-gray-600" : "bg-indigo-600 hover:bg-indigo-700"
      }`}
    >
      {busy ? "…" : joined ? "Cancel RSVP" : "RSVP"}
    </button>
  );
}
