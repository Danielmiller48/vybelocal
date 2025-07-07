'use client';
import { useState, useEffect } from 'react';
import { X, Shield } from 'lucide-react';

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
    import('@/utils/supabase/client').then(({ createSupabaseBrowser }) => {
      const supabase = createSupabaseBrowser();
      supabase.storage
        .from('profile-images')
        .createSignedUrl(avatarPath, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setUrl(data.signedUrl);
          else setUrl('/avatar-placeholder.png');
        });
    });
  }, [avatarPath]);
  return url;
}

export default function ProfileModal({ profile, isOpen, onClose, onBlock, mutualVybes = [], pastEvents = [] }) {
  const [isBlocking, setIsBlocking] = useState(false);

  // Always call the hook, even if profile is null
  const avatarUrl = useAvatarUrl(profile?.avatar_url);

  if (!isOpen || !profile) return null;

  const handleBlock = async () => {
    if (isBlocking) return;
    setIsBlocking(true);
    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: 'user', target_id: profile.uuid })
      });
      if (res.ok) {
        onBlock?.(profile.uuid);
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to block user');
      }
    } finally {
      setIsBlocking(false);
    }
  };

  const formatLastActive = (lastActive) => {
    if (!lastActive) return 'Never';
    const date = new Date(lastActive);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Profile</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Profile Content */}
        <div className="p-6 space-y-4">
          {/* Avatar and Name */}
          <div className="flex items-center gap-4">
            <img
              src={avatarUrl}
              alt={profile.name}
              className="w-16 h-16 rounded-full object-cover"
            />
            <div>
              <h3 className="text-lg font-semibold">{profile.name}</h3>
              {profile.pronouns && <p className="text-sm text-gray-600">{profile.pronouns}</p>}
            </div>
          </div>
          {/* Bio */}
          {profile.bio && <div><p className="text-gray-700">{profile.bio}</p></div>}
          {/* Last Active */}
          <div className="text-sm text-gray-500">Last active: {formatLastActive(profile.last_active_at)}</div>
          {/* Mutual Vybes */}
          {mutualVybes.length > 0 && (
            <div>
              <div className="font-medium mb-1">Mutual Vybes</div>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {mutualVybes.map((v) => <li key={v.id}>{v.title}</li>)}
              </ul>
            </div>
          )}
          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div>
              <div className="font-medium mb-1">Past Events</div>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {pastEvents.map((e) => <li key={e.id}>{e.title}</li>)}
              </ul>
            </div>
          )}
          {/* Block Button */}
          <div className="pt-4 border-t">
            <button
              onClick={handleBlock}
              disabled={isBlocking}
              className="flex items-center gap-2 py-2 px-4 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <Shield className="h-4 w-4" />
              {isBlocking ? 'Blocking...' : 'Block User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 