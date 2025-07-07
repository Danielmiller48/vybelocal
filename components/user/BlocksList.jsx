// components/BlocksList.jsx
'use client';

import React, { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/utils/supabase/client';

export default function BlocksList() {
  const [blocks, setBlocks] = useState(null);
  const [blockedProfiles, setBlockedProfiles] = useState({}); // target_id -> profile
  const supabase = createSupabaseBrowser();

  // Fetch blocked profiles on mount
  useEffect(() => {
    fetch('/api/blocks')
      .then((res) => res.json())
      .then(async (data) => {
        setBlocks(data);
        // Fetch public profiles for all blocked user target_ids
        const userBlocks = data.filter((b) => b.target_type === 'user');
        const userIds = userBlocks.map((b) => b.target_id);
        if (userIds.length > 0) {
          const { data: profiles, error } = await supabase
            .from('public_user_cards')
            .select('*')
            .in('uuid', userIds);
          if (profiles) {
            const profileMap = {};
            profiles.forEach((p) => { profileMap[p.uuid] = p; });
            setBlockedProfiles(profileMap);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to fetch blocks:', err);
        setBlocks([]);
      });
  }, [supabase]);

  // Unblock a profile
  const handleUnblock = async (blockId) => {
    await fetch(`/api/blocks/${blockId}`, { method: 'DELETE' });
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  };

  if (blocks === null) {
    return <p>Loading blocked profiles…</p>;
  }

  if (blocks.length === 0) {
    return <p>No blocked profiles.</p>;
  }

  return (
    <ul className="space-y-4">
      {blocks
        .filter((b) => b.target_type === 'user')
        .map((b) => {
          const profile = blockedProfiles[b.target_id];
          return (
            <li key={b.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {profile ? (
                  <>
                    <img
                      src={profile.avatar_url || '/avatar-placeholder.png'}
                      alt={profile.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <span className="font-medium">{profile.name}</span>
                    {profile.pronouns && <span className="text-sm text-gray-500">({profile.pronouns})</span>}
                  </>
                ) : (
                  <span className="font-medium">User ID: {b.target_id}</span>
                )}
              </div>
              <button
                className="text-sm text-blue-600 underline"
                onClick={() => handleUnblock(b.id)}
              >
                Unblock
              </button>
            </li>
          );
        })}
    </ul>
  );
}
