// components/DiscoverClient.jsx  (Client Component)
'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/utils/supabase/client';
import EventCard from '@/components/EventCard';

const vibes = ['all', 'chill', 'hype', 'creative', 'active'];

export default function DiscoverClient() {
  const supabase = createSupabaseBrowser();
  const [active, setActive] = useState('all');
  const [events, setEvents] = useState([]);

  useEffect(() => {
    async function load() {
      let q = supabase
        .from('events')
        .select('*')
        .eq('status', 'approved')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at');

      if (active !== 'all') q = q.eq('vibe', active);

      const { data } = await q;
      setEvents(data || []);
    }
    load();
  }, [active, supabase]);

  return (
    <section className="p-4 space-y-6">
      {/* vibe pills */}
      <div className="flex overflow-x-auto gap-2 pb-2">
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
      </div>

      {/* event list */}
      {events.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} />
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
