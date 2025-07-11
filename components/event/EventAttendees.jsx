"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowser } from "@/utils/supabase/client";
import ProfileModal from "./ProfileModal";

const supabase = createSupabaseBrowser();

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

function AttendeeAvatar({ profile, onClick }) {
  const avatarUrl = useAvatarUrl(profile.avatar_url);
  return (
    <button
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
      onClick={onClick}
    >
      <img
        src={avatarUrl}
        alt={profile.name}
        className="w-10 h-10 rounded-full object-cover"
      />
      <div className="text-left">
        <div className="font-medium text-sm">{profile.name}</div>
        {profile.pronouns && (
          <div className="text-xs text-gray-500">{profile.pronouns}</div>
        )}
      </div>
    </button>
  );
}

export default function EventAttendees({ eventId }) {
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalProfile, setModalProfile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    async function fetchAttendees() {
      try {
        // 1. Fetch RSVP user_ids
        const { data: rsvps, error: rsvpError } = await supabase
          .from('rsvps')
          .select('user_id')
          .eq('event_id', eventId);

        if (rsvpError) {
          console.error('Error fetching RSVPs:', rsvpError);
          setAttendees([]);
          setLoading(false);
          return;
        }

        if (!rsvps || rsvps.length === 0) {
          setAttendees([]);
          setLoading(false);
          return;
        }

        // 2. Fetch public profiles for those user_ids
        const userIds = rsvps.map(r => r.user_id);
        const { data: profiles, error: profileError } = await supabase
          .from('public_user_cards')
          .select('*')
          .in('uuid', userIds);

        if (profileError) {
          console.error('Error fetching profiles:', profileError);
          setAttendees([]);
        } else {
          setAttendees(profiles || []);
        }
      } catch (error) {
        console.error('Error in fetchAttendees:', error);
        setAttendees([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAttendees();
  }, [eventId]);

  if (loading) {
    return (
      <div className="mt-6">
        <div className="text-gray-500 italic">Loading attendees...</div>
      </div>
    );
  }

  if (attendees.length === 0) {
    return (
      <div className="mt-6">
        <div className="text-gray-500 italic">No one has RSVP'd yet. Be the first!</div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="font-semibold text-lg mb-3">
        {attendees.length} {attendees.length === 1 ? 'person' : 'people'} going to this event
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {attendees.map((profile) => (
          <AttendeeAvatar
            key={profile.uuid}
            profile={profile}
            onClick={() => {
              setModalProfile(profile);
              setModalOpen(true);
            }}
          />
        ))}
      </div>

      {/* Profile Modal */}
      <ProfileModal
        profile={modalProfile}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onReport={() => alert('Report feature coming soon!')}
      />
    </div>
  );
} 