// components/EventCard.js
"use client";

import Image from "next/image";
import Link  from "next/link";
import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import { useSession }          from "next-auth/react";
import { createSupabaseBrowser } from "@/utils/supabase/client";
import toast from 'react-hot-toast';
import ProfileModal from '@/components/event/ProfileModal';

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

function useAvatarUrl(avatarPath) {
  const [url, setUrl] = useState('/avatar-placeholder.png');
  useEffect(() => {
    if (!avatarPath || typeof avatarPath !== 'string' || avatarPath.trim() === '' || avatarPath === '/avatar-placeholder.png') {
      setUrl('/avatar-placeholder.png');
      return;
    }
    if (avatarPath.startsWith('http')) {
      setUrl(avatarPath);
      return;
    }
    supabase.storage
      .from('profile-images')
      .createSignedUrl(avatarPath, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
        else setUrl('/avatar-placeholder.png');
      });
  }, [avatarPath]);
  return url;
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
  const [hostProfile, setHostProfile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

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

  /* Fetch host profile */
  useEffect(() => {
    async function fetchHostProfile() {
      if (!event.host_id) return;
      const { data } = await supabase
        .from('public_user_cards')
        .select('*')
        .eq('uuid', event.host_id)
        .single();
      setHostProfile(data);
    }
    fetchHostProfile();
  }, [event.host_id]);

  const hostAvatarUrl = useAvatarUrl(hostProfile?.avatar_url);

  /* ───────── render ───────── */
  const Wrapper = noLink ? "div" : Link;

  const handleCardClick = (e) => {
    if (modalOpen) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <Wrapper
      {...(!noLink && { href })}
      onClick={handleCardClick}
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

        {/* Hosted by section */}
        {hostProfile && (
          <div
            className="flex items-center gap-3 mt-3 cursor-pointer hover:bg-gray-100 rounded p-2"
            onClick={e => { e.stopPropagation(); e.preventDefault(); setModalOpen(true); }}
          >
            <img
              src={hostAvatarUrl}
              alt={hostProfile.name}
              className="w-8 h-8 rounded-full object-cover"
            />
            <div>
              <div className="font-medium text-sm">{hostProfile.name}</div>
              {hostProfile.pronouns && (
                <div className="text-xs text-gray-500">{hostProfile.pronouns}</div>
              )}
            </div>
            <span className="ml-auto text-xs text-gray-400">Host</span>
          </div>
        )}

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

      {/* Profile Modal for host */}
      {hostProfile && (
        <ProfileModal
          profile={hostProfile}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          // Placeholder for report action
          onReport={() => alert('Report feature coming soon!')}
        />
      )}
    </Wrapper>
  );
}
