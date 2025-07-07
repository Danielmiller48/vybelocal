"use client";
import { Fragment, useState, useEffect } from "react";
import Link from "next/link";
import { Disclosure } from "@headlessui/react";
import {
  ChevronDown,
  PencilLine,
  Copy as CopyIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import ProfileModal from '../event/ProfileModal';
import { createSupabaseBrowser } from '@/utils/supabase/client';

const fmt = (n) => (n ?? 0).toLocaleString("en-US");

function useAvatarUrl(avatarPath) {
  const [url, setUrl] = useState('/avatar-placeholder.png');
  const supabase = createSupabaseBrowser();
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
  }, [avatarPath, supabase]);
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
export default function HostEventTable({ events = [], handleDelete }) {
  const [modalProfile, setModalProfile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [attendees, setAttendees] = useState({}); // eventId -> array of profiles
  const [openEventId, setOpenEventId] = useState(null); // Track which event's Disclosure is open
  const [eventList, setEventList] = useState(events); // Local state for events
  const supabase = createSupabaseBrowser();

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

  if (!eventList.length)
    return <p className="italic text-gray-500">No events yet.</p>;

  return (
    <section className="space-y-2">
      <h2 className="font-semibold text-lg">Your Events</h2>

      {eventList.map((e) => (
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
                    <span className="text-sm tabular-nums">{fmt(e.rsvp_count)} RSVP</span>
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
                        onClick={() => handleDelete(e.id)}
                        className="btn-icon text-red-600 hover:bg-red-50"
                        title="Delete event"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
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
    </section>
  );
}

/* --------------- tiny utility class --------------- */
// Because Tailwind doesn't ship a generic "icon button" utility out of the box.
// Add this to your global.css or keep it here for tree-shaking simplicity.
// .btn-icon {
//   @apply inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-200 transition;
// }
