// components/DiscoverClient.jsx  (Client Component)
'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/utils/supabase/client';
import EventCard from '@/components/event/EventCard';
import { useSession } from 'next-auth/react';
import EventSearchBar from '@/components/common/EventSearchBar';

const vibes = ['all', 'chill', 'hype', 'creative', 'active'];

export default function DiscoverClient({ initialEvents = null }) {
  const supabase = createSupabaseBrowser();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [active, setActive] = useState('all');
  const [events, setEvents] = useState(initialEvents || []);
  const [batch, setBatch] = useState({ rsvpCounts: {}, userRsvps: new Set(), hostProfiles: {} });
  const [batchReady, setBatchReady] = useState(false);

  useEffect(() => {
    if (initialEvents) return; // server already provided events list but may need batch data
    async function load() {
      // Fetch blocks for the current user
      let blockedUserIds = new Set();
      if (userId) {
        const { data: blocks } = await supabase
          .from('blocks')
          .select('blocker_id, target_id')
          .or(`blocker_id.eq.${userId},target_id.eq.${userId}`);
        if (blocks) {
          blocks.forEach(b => {
            if (b.blocker_id === userId) blockedUserIds.add(b.target_id);
            if (b.target_id === userId) blockedUserIds.add(b.blocker_id);
          });
        }
      }
      // Fetch events
      let q = supabase
        .from('events')
        .select('*')
        .eq('status', 'approved')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at');
      if (active !== 'all') q = q.eq('vibe', active);
      const { data } = await q;
      // Filter out events hosted by blocked users
      const filtered = (data || []).filter(ev => !blockedUserIds.has(ev.host_id));
      setEvents(filtered);
    }
    load();
  }, [active, supabase, userId, initialEvents]);

  /* Batch fetch RSVP counts, user RSVPs, host profiles whenever events change */
  useEffect(() => {
    if (events.length === 0) return;

    async function batchFetch() {
      const eventIds = events.map(e => e.id);
      const hostIds  = [...new Set(events.map(e => e.host_id))];

      const promises = [];

      // RSVP counts
      promises.push(
        supabase.from('rsvps')
          .select('event_id')
          .in('event_id', eventIds)
          .then(({ data }) => {
            const map = {};
            eventIds.forEach(id => map[id] = 0);
            (data || []).forEach(r => { map[r.event_id] = (map[r.event_id]||0)+1; });
            return map;
          })
      );

      // User RSVPs if logged in
      if (userId) {
        promises.push(
          supabase.from('rsvps')
            .select('event_id')
            .eq('user_id', userId)
            .in('event_id', eventIds)
            .then(({ data }) => new Set((data||[]).map(r=>r.event_id)))
        );
      } else {
        promises.push(Promise.resolve(new Set()));
      }

      // Host profiles
      promises.push(
        supabase.from('public_user_cards')
          .select('*')
          .in('uuid', hostIds)
          .then(({ data }) => {
            const map = {};
            (data||[]).forEach(p=>{ map[p.uuid]=p; });
            return map;
          })
      );

      const [rsvpCounts, userRsvpSet, hostProfiles] = await Promise.all(promises);
      setBatch({ rsvpCounts, userRsvps: userRsvpSet, hostProfiles });
      setBatchReady(true);
    }
    batchFetch();
  }, [events, supabase, userId]);

  // Render loading placeholder until batch maps are ready
  if (events.length && !batchReady) {
    return <p className="p-6">Loading…</p>;
  }

  return (
    <section className="p-4 space-y-6">
      {/* vibe pills + search */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        {vibes.map((v) => (
          <button
            key={v}
            onClick={() => setActive(v)}
            className={`px-4 py-1 rounded-full text-sm capitalize whitespace-nowrap ${
              active === v
                ? 'bg-violet-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {v}
          </button>
        ))}
        <div className="flex-1" />
        <EventSearchBar />
      </div>

      {/* event list */}
      {events.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              img={ev.thumb}
              rsvpCountProp={batch.rsvpCounts[ev.id]}
              userRsvpStatus={batch.userRsvps.has ? batch.userRsvps.has(ev.id) : false}
              hostProfileProp={batch.hostProfiles[ev.host_id]}
            />
          ))}
        </div>
      ) : (
        <p className="text-gray-500 italic">
          No upcoming events in this vibe. Check back later or host one!
        </p>
      )}
    </section>
  );
}
