// components/EventCard.js
"use client";

import Image from "next/image";
import Link  from "next/link";
import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import { useSession }          from "next-auth/react";
import { createSupabaseBrowser } from "@/utils/supabase/client";
import toast from 'react-hot-toast';

const supabase = createSupabaseBrowser();

/* ───────── helpers ───────── */
async function getSignedUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage
    .from("event-images")
    .createSignedUrl(path, 3600, {
      transform: { width: 640, height: 480, resize: "cover" },
    });
  return data?.signedUrl ?? null;
}

function useImage({ img, img_path }) {
  const [url, setUrl] = useState(img || null);
  useEffect(() => {
    if (!url) getSignedUrl(img_path).then(setUrl);
  }, [url, img_path]);
  return url || "/placeholder.jpg";
}

/* ───────── component ───────── */
export default function EventCard({
  event,
  img,
  onApprove,
  onDeny,
  onPending,
  onDelete,
  noLink = false,
  disabled = false,
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [bridged, setBridged] = useState(false);
  const [joined,  setJoined]  = useState(false);
  const [busy,    setBusy]    = useState(false);

  const isAdmin  = !!(onApprove || onDeny || onPending || onDelete);
  const imageSrc = useImage({ img, img_path: event.img_path });
  const href     = isAdmin ? `/admin/dashboard/${event.id}` : `/vybes/${event.id}`;

  /* 1 ─ bridge Next-Auth → Supabase once */
  useEffect(() => {
    (async () => {
      if (status !== "authenticated") { setBridged(true); return; }

      const {
        data: { session: sbSession },
      } = await supabase.auth.getSession();

      if (!sbSession) {
        const at =
          session.supabase?.access_token   ?? session.supabaseAccessToken;
        const rt =
          session.supabase?.refresh_token  ?? session.supabaseRefreshToken;

        if (at && rt) {
          await supabase.auth.setSession({ access_token: at, refresh_token: rt });
        }
      }
      setBridged(true);
    })();
  }, [status, session]);

  /* 2 ─ fetch existing RSVP */
  useEffect(() => {
    if (!bridged || status !== "authenticated") return;
    (async () => {
      const { data } = await supabase
        .from("rsvps")
        .select("event_id")
        .eq("event_id", event.id)
        .eq("user_id", session.user.id)
        .maybeSingle();
      setJoined(Boolean(data));
    })();
  }, [bridged, status, event.id, session?.user?.id]);

  /* 3 ─ RSVP toggle */
  async function toggleRsvp(e) {
  e.stopPropagation();
  e.preventDefault();

  if (status !== "authenticated") {
    router.push(`/login?next=/vybes/${event.id}`);
    return;
  }
  if (busy) return;

  setBusy(true);
  const row = { event_id: event.id, user_id: session.user.id };
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
    ({ error } = await supabase
      .from("rsvps")
      .delete()
      .match(row));
    if (!error) {
      setJoined(false);
      toast("RSVP cancelled.");
    }
  }

  setBusy(false);
  if (error && error.code !== "23505") {
    toast.error("Something went wrong.");
    console.error(error.message);
  }
}

  /* ───────── render ───────── */
  const Wrapper = noLink ? "div" : Link;

  return (
    <Wrapper
      {...(!noLink && { href })}
      className={
        "rounded-xl overflow-hidden shadow-md flex flex-col bg-white " +
        (noLink ? "" : "hover:shadow-lg transition-shadow")
      }
    >
      <Image
        src={imageSrc}
        alt={event.title}
        width={640}
        height={480}
        className="object-cover aspect-[4/3] w-full"
        unoptimized
      />

      <div className="p-4 flex flex-col grow">
        <h3 className="font-semibold text-lg mb-1 line-clamp-1">
          {event.title}
        </h3>
        <p className="text-sm text-gray-600 line-clamp-2 grow">
          {event.description}
        </p>

        {/* Public RSVP toggle */}
        {!isAdmin && (
          <button
            onClick={toggleRsvp}
            disabled={busy}
            className={
              "mt-3 py-2 px-4 rounded-lg w-full transition " +
              (joined
                ? "bg-gray-500 hover:bg-gray-600 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white") +
              (busy ? " opacity-60 cursor-wait" : "")
            }
          >
            {busy ? "…" : joined ? "Cancel RSVP" : "RSVP"}
          </button>
        )}

        {/* (admin buttons unchanged) */}
        {isAdmin && (onApprove || onDeny || onPending) && (
          <div className="mt-3 flex gap-2">
            {onApprove && (
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!disabled) onApprove(); }}
                disabled={disabled}
                className="flex-1 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
            )}
            {onDeny && (
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!disabled) onDeny(); }}
                disabled={disabled}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            )}
            {onPending && (
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!disabled) onPending(); }}
                disabled={disabled}
                className="flex-1 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
              >
                Pending
              </button>
            )}
          </div>
        )}

        {typeof onDelete === "function" && (
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!disabled) onDelete(); }}
            disabled={disabled}
            className="mt-3 w-full py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete Permanently
          </button>
        )}
      </div>
    </Wrapper>
  );
}
