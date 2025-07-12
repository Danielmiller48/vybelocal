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
import { FaFlag } from 'react-icons/fa';
import ReactDOM from 'react-dom';
import TrustedHostBadge from '../TrustedHostBadge';
import { getHostProfile } from '@/utils/supabase/profileCache';

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
  userRsvpStatus = null,
  rsvpCountProp = null,
  hostProfileProp = null,
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
  const [joined,  setJoined]  = useState(userRsvpStatus ?? false);
  const [busy,    setBusy]    = useState(false);
  const [hostProfile, setHostProfile] = useState(hostProfileProp ?? null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [rsvpCount, setRsvpCount] = useState(rsvpCountProp ?? 0);

  const reportReasons = [
    { value: 'spam', label: 'Spam or scam' },
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'misinfo', label: 'Misinformation' },
    { value: 'other', label: 'Other' },
  ];

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

  /* 2 ─ fetch existing RSVP when not provided */
  useEffect(() => {
    if (userRsvpStatus !== null) return;
    if (!bridged || status !== "authenticated") return;
    (async () => {
      console.log("EventCard: Fetching user RSVP status for event:", event.id, "user:", session.user.id);
      const { data, error } = await supabase
        .from("rsvps")
        .select("event_id")
        .eq("event_id", event.id)
        .eq("user_id", session.user.id)
        .maybeSingle();
      
      if (error) {
        console.error("EventCard: Error fetching user RSVP status:", error);
      } else {
        console.log("EventCard: User RSVP status fetched:", data);
        setJoined(Boolean(data));
      }
    })();
  }, [bridged, status, event.id, session?.user?.id]);

  /* 3 ─ fetch RSVP count when not provided */
  useEffect(() => {
    if (rsvpCountProp !== null) return;
    if (!bridged) return;
    (async () => {
      console.log("EventCard: Fetching RSVP count for event:", event.id);
      const { count, error } = await supabase
        .from("rsvps")
        .select("event_id", { count: "exact" })
        .eq("event_id", event.id);
      
      if (error) {
        console.error("EventCard: Error fetching RSVP count:", error);
      } else {
        console.log("EventCard: RSVP count fetched:", count);
        setRsvpCount(count ?? 0);
      }
    })();
  }, [bridged, event.id]);

  /* 4 ─ RSVP toggle */
  async function toggleRsvp(e) {
    e.stopPropagation();
    e.preventDefault();

    if (status !== "authenticated") {
      router.push(`/login?next=/vybes/${event.id}`);
      return;
    }
    if (busy) return;

    // Check capacity before allowing RSVP
    const capacity = event.rsvp_capacity;
    if (!joined && capacity && rsvpCount >= capacity) {
      toast.error("This event is at maximum capacity.");
      return;
    }

    setBusy(true);
    const row = { event_id: event.id, user_id: session.user.id };
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
      // Cancel flow with confirmation
      if (!confirm("Are you sure you want to cancel your RSVP?")) {
        setBusy(false);
        return;
      }
      ({ error } = await supabase
        .from("rsvps")
        .delete()
        .match(row));
      if (!error) {
        setJoined(false);
        setRsvpCount(rsvpCount - 1);
        toast("RSVP cancelled.");
      }
    }

    setBusy(false);
    if (error && error.code !== "23505") {
      toast.error("Something went wrong.");
      console.error(error.message);
    }
  }

  /* Fetch host profile with cache if not provided */
  useEffect(() => {
    if (hostProfileProp) { return; }
    async function fetchHostProfile() {
      if (!event.host_id) return;
      const profile = await getHostProfile(event.host_id);
      if (profile) setHostProfile(profile);
    }
    fetchHostProfile();
  }, [event.host_id]);

  const hostAvatarUrl = useAvatarUrl(hostProfile?.avatar_url);

  function ReportModal({ open, onClose, reason, setReason, busy, onSubmit, reasons }) {
    const [details, setDetails] = useState('');
    // Reset details when modal opens/closes
    useEffect(() => { if (!open) setDetails(''); }, [open]);
    if (!open) return null;
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 pointer-events-auto" onClick={onClose}>
        <div
          className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg relative"
          onClick={e => e.stopPropagation()}
        >
          <button
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
          <h2 className="text-xl font-bold mb-2">Something off? Let us know.</h2>
          <div className="mb-4 text-gray-700 text-sm leading-relaxed">
            <p>VybeLocal is built on trust and real-world respect.<br/>
            If this event or user feels unsafe, misleading, or out of alignment with our community values, please tell us.</p>
            <p className="mt-2">You’re not starting drama—you’re helping us protect the vibe.</p>
            <p className="mt-2">We review all reports with care, and your voice stays private.</p>
          </div>
          <form onSubmit={e => { e.preventDefault(); onSubmit(reason, details); }}>
            <label className="block mb-2 font-medium">What’s going on?</label>
            <select
              className="w-full mb-4 p-2 border rounded"
              value={reason}
              onChange={e => setReason(e.target.value)}
            >
              <option value="spam">Spam or scam</option>
              <option value="nsfw">NSFW or inappropriate content</option>
              <option value="unsafe">Unsafe or violent behavior</option>
              <option value="hate">Hate speech or discrimination</option>
              <option value="misleading">Misleading or false event</option>
              <option value="other">Other (please describe)</option>
            </select>
            <textarea
              className="w-full p-2 border rounded mb-4 placeholder-gray-400"
              rows={4}
              placeholder="Add any details that might help us understand the context (optional)"
              value={details}
              onChange={e => setDetails(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 font-semibold text-base"
            >
              {busy ? 'Reporting…' : 'Submit Report'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  async function handleReportSubmit(reason, details) {
    if (reportBusy) return;
    setReportBusy(true);
    try {
      const res = await fetch('/api/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: 'event',
          target_id: event.id,
          user_id: event.host_id,
          reason_code: reason,
          details: details || null,
          source: 'user',
        }),
      });
      if (res.ok) {
        toast.success('Thank you for your report.');
        setReportOpen(false);
        setReportReason('spam');
      } else {
        toast.error('Failed to submit report.');
      }
    } catch (err) {
      toast.error('Failed to submit report.');
    }
    setReportBusy(false);
  }

  // Close modal on Escape
  useEffect(() => {
    if (!reportOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') setReportOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reportOpen]);

  /* ───────── render ───────── */
  const Wrapper = noLink ? "div" : Link;

  const handleCardClick = (e) => {
    if (modalOpen) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <>
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
          width={320}
          height={240}
          className="object-cover aspect-[4/3] w-full"
          loading="lazy"
          unoptimized
        />

        <div className="p-4 flex flex-col grow relative">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-semibold text-lg line-clamp-1">{event.title}</h3>
            <button
              className="text-gray-400 hover:text-red-500 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-red-300"
              style={{ fontSize: 18 }}
              title="Report event"
              onClick={e => { e.stopPropagation(); e.preventDefault(); setReportOpen(true); }}
            >
              <FaFlag />
            </button>
          </div>
          {/* ... existing code ... */}
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
              <div className="ml-auto">
                <TrustedHostBadge is_trusted={hostProfile.is_trusted} />
              </div>
            </div>
          )}

          {/* Public RSVP toggle */}
          {!isAdmin && (
            <button
              onClick={toggleRsvp}
              disabled={busy || (!joined && event.rsvp_capacity && rsvpCount >= event.rsvp_capacity)}
              className={
                "mt-3 py-2 px-4 rounded-lg w-full transition " +
                (joined
                  ? "bg-gray-500 hover:bg-gray-600 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white") +
                (busy ? " opacity-60 cursor-wait" : "") +
                ((!joined && event.rsvp_capacity && rsvpCount >= event.rsvp_capacity) ? " opacity-50 cursor-not-allowed" : "")
              }
            >
              {busy 
                ? "…" 
                : joined 
                  ? "Cancel RSVP" 
                  : (!joined && event.rsvp_capacity && rsvpCount >= event.rsvp_capacity)
                    ? "Max capacity reached"
                    : event.rsvp_capacity 
                      ? `RSVP (${Math.max(0, event.rsvp_capacity - rsvpCount)} left)`
                      : "RSVP"
              }
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
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        reason={reportReason}
        setReason={setReportReason}
        busy={reportBusy}
        onSubmit={handleReportSubmit}
        reasons={reportReasons}
      />
      {/* Profile Modal for host */}
      {hostProfile && (
        <ProfileModal
          profile={hostProfile}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          avatarUrl={hostAvatarUrl}
          // Placeholder for report action
          onReport={() => alert('Report feature coming soon!')}
        />
      )}
    </>
  );
}
