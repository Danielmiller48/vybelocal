// components/EventCard.js — unified public + admin card (RSVP + noLink fix)
"use client";

import Image from "next/image";
import Link  from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import supabase from "@/utils/supabase/browser";

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
  noLink = false,          // ← NEW
  disabled = false,
}) {
  const { data: auth, status } = useSession();
  const router   = useRouter();

  const [bridged, setBridged]   = useState(false);
  const [joined,  setJoined]    = useState(false);
  const [busy,    setBusy]      = useState(false);

  const isAdmin = !!(onApprove || onDeny || onPending || onDelete);

  const imageSrc = useImage({ img, img_path: event.img_path });
  const href     = isAdmin
    ? `/admin/dashboard/${event.id}`
    : `/vybes/${event.id}`;

  /* 1 ─ bridge NextAuth → Supabase once */
  useEffect(() => {
    (async () => {
      if (status !== "authenticated") {
        setBridged(true);
        return;
      }
      const sbSess = (await supabase.auth.getSession()).data.session;
      if (!sbSess && auth?.supabaseAccessToken) {
        await supabase.auth.setSession({
          access_token  : auth.supabaseAccessToken,
          refresh_token : auth.supabaseRefreshToken ?? null,
        });
      }
      setBridged(true);
    })();
  }, [status, auth]);

  /* 2 ─ fetch existing RSVP */
  useEffect(() => {
    if (!bridged || status !== "authenticated") return;
    (async () => {
      const { data } = await supabase
        .from("rsvps")
        .select("event_id")
        .eq("event_id", event.id)
        .maybeSingle();
      setJoined(!!data);
    })();
  }, [bridged, status, event.id]);

  /* 3 ─ RSVP click */
  async function rsvp(e) {
    e.stopPropagation();
    e.preventDefault();

    if (status !== "authenticated") {
      router.push(`/login?next=/vybes/${event.id}`);
      return;
    }
    if (joined || busy) return;

    setBusy(true);
    const { error } = await supabase
      .from("rsvps")
      .insert({ event_id: event.id, user_id: auth.user.id });
    setBusy(false);

    if (error && error.code !== "23505") {
      alert(error.message);
      return;
    }
    setJoined(true);
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

        {/* Public RSVP */}
        {!isAdmin && (
          <button
            onClick={rsvp}
            disabled={joined || busy}
            className={
              "mt-3 py-2 px-4 rounded-lg w-full " +
              (joined
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white") +
              (busy ? " opacity-50" : "")
            }
          >
            {joined ? "Going ✔" : busy ? "…" : "RSVP"}
          </button>
        )}

        {/* Admin action bar */}
        {isAdmin && (onApprove || onDeny || onPending) && (
          <div className="mt-3 flex gap-2">
            {onApprove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (!disabled) onApprove();
                }}
                disabled={disabled}
                className="flex-1 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
            )}
            {onDeny && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (!disabled) onDeny();
                }}
                disabled={disabled}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            )}
            {onPending && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (!disabled) onPending();
                }}
                disabled={disabled}
                className="flex-1 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
              >
                Pending
              </button>
            )}
          </div>
        )}

        {/* Admin delete (Rejected tab) */}
        {typeof onDelete === "function" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (!disabled) onDelete();
            }}
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
