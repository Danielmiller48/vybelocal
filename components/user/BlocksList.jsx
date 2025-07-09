// components/BlocksList.jsx
'use client';

import React, { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/utils/supabase/client';

export default function BlocksList() {
  const [blocks, setBlocks] = useState(null);
  const [blockedProfiles, setBlockedProfiles] = useState({}); // target_id -> profile
  const [avatarUrls, setAvatarUrls] = useState({}); // target_id -> signed avatar url
  const [confirmUnblock, setConfirmUnblock] = useState(null); // block to confirm
  const [successMsg, setSuccessMsg] = useState('');
  const supabase = createSupabaseBrowser();

  // Fetch blocked profiles on mount
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('blocks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Failed to fetch blocks:', error);
        setBlocks([]);
        return;
      }
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
          // Fetch signed avatar URLs for each profile
          const urlMap = {};
          await Promise.all(profiles.map(async (p) => {
            let url = '/avatar-placeholder.png';
            if (p.avatar_url && typeof p.avatar_url === 'string' && p.avatar_url.trim() !== '' && p.avatar_url !== '/avatar-placeholder.png') {
              if (p.avatar_url.startsWith('http')) {
                url = p.avatar_url;
              } else {
                const { data: signed } = await supabase.storage
                  .from('profile-images')
                  .createSignedUrl(p.avatar_url, 3600);
                if (signed?.signedUrl) url = signed.signedUrl;
              }
            }
            urlMap[p.uuid] = url;
          }));
          setAvatarUrls(urlMap);
        }
      }
    })();
  }, [supabase]);

  // Unblock a profile (with flag removal)
  const handleUnblock = async (block) => {
    // Show confirmation popup
    setConfirmUnblock(block);
  };

  const confirmUnblockAction = async () => {
    if (!confirmUnblock) return;
    // 1. Delete the block
    await fetch(`/api/blocks/${confirmUnblock.id}`, { method: 'DELETE' });
    // 2. Delete the flag (by target_type, target_id)
    await fetch('/api/flags', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_type: confirmUnblock.target_type,
        target_id: confirmUnblock.target_id,
      })
    });
    setBlocks((prev) => prev.filter((b) => b.id !== confirmUnblock.id));
    setSuccessMsg('Unblocked and report removed.');
    setConfirmUnblock(null);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  if (blocks === null) {
    return <p>Loading blocked profiles…</p>;
  }

  if (blocks.length === 0) {
    return <p>No blocked profiles.</p>;
  }

  return (
    <>
      {successMsg && (
        <div className="mb-4 p-2 bg-green-100 text-green-700 rounded text-center">{successMsg}</div>
      )}
      <ul className="space-y-4">
        {blocks
          .filter((b) => b.target_type === 'user')
          .map((b) => {
            const profile = blockedProfiles[b.target_id];
            const avatarUrl = avatarUrls[b.target_id] || '/avatar-placeholder.png';
            return (
              <li key={b.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {profile ? (
                    <>
                      <img
                        src={avatarUrl}
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
                  onClick={() => handleUnblock(b)}
                >
                  Unblock
                </button>
              </li>
            );
          })}
      </ul>
      {/* Confirmation Modal */}
      {confirmUnblock && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-lg">
            <h2 className="text-lg font-semibold mb-2">Unblock?</h2>
            <p className="mb-4">Are you sure you want to unblock this user? This will also remove your report.</p>
            <div className="flex gap-4 justify-end">
              <button
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                onClick={() => setConfirmUnblock(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={confirmUnblockAction}
              >
                Unblock
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
