// components/settings/EditProfileModal.jsx
"use client";
import BaseModal from './BaseModal';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { createSupabaseBrowser } from '@/utils/supabase/client';
import ProfileClient from '@/components/user/ProfileClient';
import ProfileImageUploader from './ProfileImageUploader';
import { getAvatarUrl } from '@/utils/supabase/avatarCache';
import BasicInfoForm from './BasicInfoForm';
import PhoneForm from './PhoneForm';

// simple placeholders for now
function EmailForm() {
  return <p className="text-sm text-gray-600">Email change / verification coming soon.</p>;
}

export default function EditProfileModal({ open, onClose }) {
  const { data: session } = useSession();
  const [profile, setProfile] = useState(null);

  const [avatarUrl,setAvatarUrl] = useState('/avatar-placeholder.png');
  const [tab, setTab] = useState('basic');

  useEffect(() => {
    if (!open) return;
    (async () => {
      const sb = createSupabaseBrowser();
      const { data } = await sb
        .from('profiles')
        .select('*')
        .eq('id', session?.user?.id)
        .single();
      setProfile(data);

      if(data?.avatar_url){
        const url = await getAvatarUrl(data.avatar_url);
        setAvatarUrl(url);
      } else {
        setAvatarUrl('/avatar-placeholder.png');
      }
    })();
  }, [open, session?.user?.id]);

  return (
    <BaseModal open={open} onClose={onClose}>
      <h2 className="text-lg font-bold mb-4">Edit Profile</h2>
      {!profile ? (
        <p>Loading…</p>
      ) : (
        <div className="grid sm:grid-cols-[150px_1fr] gap-6">
          {/* left micro-nav */}
          <nav className="flex flex-col gap-2 text-sm">
            {['image','basic','phone','email'].map(key=> (
              <button
                key={key}
                onClick={()=>setTab(key)}
                className={`px-3 py-1 rounded text-left ${tab===key?'bg-indigo-600 text-white':'hover:bg-gray-100'}`}
              >{key==='image'?'Profile Image': key==='basic'?'Basic Info': key==='phone'?'Phone Number':'Email'}</button>
            ))}
          </nav>

          {/* right panel */}
          <div className="min-w-0">
            {tab==='image' && (
              <ProfileImageUploader
                userId={profile.id}
                currentUrl={avatarUrl}
                onDone={async (path)=>{
                  const sb=createSupabaseBrowser();
                  await sb.from('profiles').update({ avatar_url:path }).eq('id', profile.id);
                  const url = await getAvatarUrl(path);
                  setAvatarUrl(url);
                }}
              />
            )}
            {tab==='basic' && (<BasicInfoForm profile={profile} onSaved={()=>{}} />)}
            {tab==='phone' && (<PhoneForm />)}
            {tab==='email' && (<EmailForm />)}
          </div>
        </div>
      )}
    </BaseModal>
  );
} 