"use client";
import { Fragment, useState, useEffect } from "react";
import Link from "next/link";
import { Disclosure } from "@headlessui/react";
import {
  ChevronDown,
  PencilLine,
  Copy as CopyIcon,
  Trash2 as TrashIcon,
  XCircle as CancelIcon,
} from "lucide-react";
import ProfileModal from '../event/ProfileModal';
import CancelEventModal from './CancelEventModal';
import { createSupabaseBrowser } from '@/utils/supabase/client';
import { getAvatarUrl } from '@/utils/supabase/avatarCache';

const fmt = (n) => (n ?? 0).toLocaleString("en-US");

// Builds a friendly label for paid attendee counts.
// If some RSVPs exist but payment not completed yet, we show them as “UNPAID”.
function formatPaidStatus(paid = 0, unpaid = 0) {
  paid = paid ?? 0;
  unpaid = unpaid ?? 0;
  if (paid > 0 && unpaid > 0) return `${fmt(paid)} PAID / ${fmt(unpaid)} UNPAID`;
  if (paid > 0) return `${fmt(paid)} PAID`;
  if (unpaid > 0) return `${fmt(unpaid)} UNPAID`;
  return "0 PAID"; // default when no RSVPs yet
}

function useAvatarUrl(avatarPath) {
  const [url, setUrl] = useState('/avatar-placeholder.png');
  useEffect(() => {
    (async () => {
      const signed = await getAvatarUrl(avatarPath);
      setUrl(signed);
    })();
  }, [avatarPath]);
  return url;
}

function AttendeeAvatar({ profile, onClick }) {
  const avatarUrl = useAvatarUrl(profile.avatar_url);
  return (
    <button
      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-200"
      onClick={onClick}
    >
      <img
        src={avatarUrl}
        alt={profile.name}
        className="w-8 h-8 rounded-full object-cover"
      />
      <span>{profile.name}</span>
    </button>
  );
}

function BlockedUserAvatar({ profile }) {
  const avatarUrl = useAvatarUrl(profile.avatar_url);
  return (
    <img
      src={avatarUrl}
      alt={profile.name}
      className="w-8 h-8 rounded-full object-cover"
    />
  );
}

/**
 * HostEventAccordion – replaces the table with an accordion tool-set.
 *
 * Each event renders as a Headless UI <Disclosure> so we get:
 *   • Keyboard-accessible expand / collapse (Enter / Space)
 *   • ARIA roles + focus management baked in
 *
 * Inside the panel we surface quick-action buttons:
 *   • Edit (link to event detail page)
 *   • View RSVPs
 *   • Duplicate (placeholder handler)
 *   • Delete (placeholder handler)
 *
 * Tailwind + lucide-react icons keep things lightweight; no extra CSS.
 */
export default function HostEventTable({ events = [], handleDelete, showUpcomingTab=true, showPastTab=true, showCanceledTab=true, initialTab='upcoming' }) {
  const [modalProfile, setModalProfile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [attendees, setAttendees] = useState({}); // eventId -> array of profiles
  const [openEventId, setOpenEventId] = useState(null); // Track which event's Disclosure is open
  const [eventList, setEventList] = useState(events); // all events
  const [tab, setTab] = useState(initialTab);
  const [pastLimit, setPastLimit] = useState(15);
  const supabase = createSupabaseBrowser();
  const [cancelEventId, setCancelEventId] = useState(null); // event id being canceled

  useEffect(() => { setEventList(events); }, [events]);

  async function fetchAttendees(eventId, force = false) {
    if (attendees[eventId] && !force) return; // already fetched unless force
    // 1. Fetch RSVP user_ids
    const { data: rsvps, error: rsvpError } = await supabase
      .from('rsvps')
      .select('user_id')
      .eq('event_id', eventId);
    if (rsvpError || !rsvps || rsvps.length === 0) {
      setAttendees((prev) => ({ ...prev, [eventId]: [] }));
      return;
    }
    // 2. Fetch public profiles for those user_ids
    const userIds = rsvps.map(r => r.user_id);
    const { data: profiles, error: profileError } = await supabase
      .from('public_user_cards')
      .select('*')
      .in('uuid', userIds);
    setAttendees((prev) => ({ ...prev, [eventId]: profiles || [] }));
  }

  // Fetch attendees when a Disclosure is opened
  useEffect(() => {
    if (openEventId) fetchAttendees(openEventId, true);
  }, [openEventId]);

  async function handleDelete(eventId) {
    if (!window.confirm('Are you sure you want to delete this event? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        alert('Failed to delete event: ' + (err.error || 'Unknown error'));
        return;
      }
      setEventList((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      alert('Failed to delete event: ' + err.message);
    }
  }

  const nowTs = Date.now();
  const upcoming = eventList.filter(e => {
    if(e.status==='canceled') return false;
    const endTs = e.ends_at ? new Date(e.ends_at).getTime() : new Date(e.starts_at).getTime();
    return endTs >= nowTs;
  });
  const pastAll  = eventList.filter(e => {
    const endTs = e.ends_at ? new Date(e.ends_at).getTime() : new Date(e.starts_at).getTime();
    return endTs < nowTs;
  });
  const past     = pastAll.slice(0, pastLimit);
  const canceled = eventList.filter(e=> e.status==='canceled');

  const listToShow = tab==='upcoming' ? upcoming : (tab==='past'? past : canceled);

  if (!eventList.length)
    return <p className="italic text-gray-500">No events yet.</p>;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        {showUpcomingTab && (
          <button
            onClick={()=>setTab('upcoming')}
            className={`px-3 py-1 rounded ${tab==='upcoming'?'bg-indigo-600 text-white':'bg-gray-200'}`}
          >Upcoming</button>
        )}
        {showPastTab && (
          <button
            onClick={()=>setTab('past')}
            className={`px-3 py-1 rounded ${tab==='past'?'bg-indigo-600 text-white':'bg-gray-200'}`}
          >Past</button>
        )}
        {showCanceledTab && (
          <button
            onClick={()=>setTab('canceled')}
            className={`px-3 py-1 rounded ${tab==='canceled'?'bg-indigo-600 text-white':'bg-gray-200'}`}
          >Canceled</button>
        )}
      </div>

      {tab==='past' && pastAll.length>pastLimit && (
        <button
          onClick={()=>setPastLimit(pastLimit+15)}
          className="mb-2 text-sm text-indigo-600 hover:underline"
        >Load older events…</button>
      )}

      {listToShow.map((e) => (
        <Disclosure key={e.id} as="div" className="bg-white rounded shadow">
          {({ open }) => {
            return (
              <>
                {/* summary bar */}
                <Disclosure.Button
                  className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/75"
                  onClick={() => setOpenEventId(open ? null : e.id)}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className="font-medium truncate max-w-[12rem] sm:max-w-xs">
                      {e.title}
                    </span>
                    <span
                      className={
                        {
                          draft: "bg-yellow-100 text-yellow-800",
                          live: "bg-green-100 text-green-800",
                          closed: "bg-gray-200 text-gray-700",
                          approved: "bg-green-100 text-green-800",
                        }[e.status] +
                        " px-2 py-0.5 rounded text-[11px] uppercase tracking-wide"
                      }
                    >
                      {e.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-6">
                    {e.price_in_cents !== null && e.price_in_cents>0 ? (
                      <span className="text-sm tabular-nums">{formatPaidStatus(e.paid_count, e.unpaid_count)}</span>
                    ) : (
                      <span className="text-sm tabular-nums">{fmt(e.rsvp_count)} RSVP</span>
                    )}
                    {e.price_in_cents !== null && e.price_in_cents>0 && e.expected_payout_cents > 0 && (
                      <span className="text-sm text-green-700 font-medium">${(e.expected_payout_cents/100).toFixed(2)}</span>
                    )}
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${open ? "rotate-180" : "rotate-0"}`}
                    />
                  </div>
                </Disclosure.Button>

                {/* detail panel */}
                <Disclosure.Panel className="px-6 py-4 border-t text-sm bg-gray-50">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    {/* left: meta info */}
                    <div className="space-y-1 max-w-xl">
                      {e.description && (
                        <p>
                          <span className="font-medium">Description: </span>
                          {e.description}
                        </p>
                      )}
                      {e.location && (
                        <p>
                          <span className="font-medium">Location: </span>
                          {e.location}
                        </p>
                      )}
                      {e.starts_at && (
                        <p>
                          <span className="font-medium">Date: </span>
                          {new Date(e.starts_at).toLocaleString()}
                        </p>
                      )}
                      {e.price_in_cents !== null && e.price_in_cents>0 && e.expected_payout_cents > 0 && (
                        <p><span className="font-medium">Expected payout: </span>${(e.expected_payout_cents/100).toFixed(2)}</p>
                      )}
                      <p><span className="font-medium">Refund policy: </span>{e.refund_policy.replace('_',' ')}</p>
                      <Countdown startsAt={e.starts_at} />
                      {/* RSVP attendee list */}
                      {attendees[e.id]?.length > 0 && (
                        <div className="mt-3">
                          <p className="font-medium mb-2">Attendees:</p>
                          <div className="flex flex-wrap gap-3">
                            {attendees[e.id].map((profile) => (
                              <AttendeeAvatar
                                key={profile.uuid}
                                profile={profile}
                                onClick={() => { setModalProfile(profile); setModalOpen(true); }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Fallbacks for debugging */}
                      {!attendees[e.id] && (
                        <div className="mt-3 text-gray-400 italic">Loading attendees…</div>
                      )}
                      {attendees[e.id] && attendees[e.id].length === 0 && (
                        <div className="mt-3 text-gray-400 italic">No attendees yet.</div>
                      )}
                    </div>

                    {/* right: tool set */}
                    <div className="flex gap-3 flex-wrap shrink-0">
                      <Link
                        href={`/host/events/${e.id}`}
                        className="btn-icon"
                        title="Edit event"
                      >
                        <PencilLine className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => console.log("duplicate", e.id)}
                        className="btn-icon"
                        title="Duplicate event"
                      >
                        <CopyIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setCancelEventId(e.id)}
                        className="btn-icon text-red-600 hover:bg-red-50"
                        title="Cancel & refund"
                      >
                        <CancelIcon className="h-4 w-4" />
                      </button>
                      {/* Hard-delete option removed; hosts must use Cancel & Refund */}
                    </div>
                  </div>
                </Disclosure.Panel>
              </>
            );
          }}
        </Disclosure>
      ))}
      {/* Profile Modal */}
      <ProfileModal
        profile={modalProfile}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onBlock={() => {
          setModalOpen(false);
          if (openEventId) fetchAttendees(openEventId, true);
        }}
        useAvatarUrl={useAvatarUrl}
      />
      {/* Cancel Event Modal */}
      <CancelEventModal
        open={Boolean(cancelEventId)}
        eventId={cancelEventId}
        onClose={(success)=>{
          if(success){ setEventList(prev=>prev.filter(ev=>ev.id!==cancelEventId)); }
          setCancelEventId(null);
        }}
      />
    </section>
  );
}

/* ---------- small countdown component ---------- */
function Countdown({ startsAt }) {
  const [diff, setDiff] = useState(() => calc());

  function calc() {
    const ms = new Date(startsAt).getTime() - Date.now();
    if (ms <= 0) return "Started";
    const hrs = Math.floor(ms / 3600000);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `${days}d ${hrs % 24}h`;
    return `${hrs}h`;
  }

  useEffect(() => {
    const id = setInterval(() => setDiff(calc()), 60000);
    return () => clearInterval(id);
  }, [startsAt]);

  return <p><span className="font-medium">Starts in: </span>{diff}</p>;
}

/* --------------- tiny utility class --------------- */
// Because Tailwind doesn't ship a generic "icon button" utility out of the box.
// Add this to your global.css or keep it here for tree-shaking simplicity.
// .btn-icon {
//   @apply inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-200 transition;
// }
