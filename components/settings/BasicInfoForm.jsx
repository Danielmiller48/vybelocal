// components/settings/BasicInfoForm.jsx
"use client";
import { useForm } from 'react-hook-form';
import { createSupabaseBrowser } from '@/utils/supabase/client';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function BasicInfoForm({ profile, onSaved }) {
  const sb = createSupabaseBrowser();
  const { register, handleSubmit, formState:{errors,isSubmitting} } = useForm({
    defaultValues:{
      name: profile?.name || '',
      bio:  profile?.bio  || '',
    }
  });
  const [dirty,setDirty]=useState(false);

  async function onSubmit(vals){
    if(!profile?.id){ toast.error('Missing profile id'); return; }
    const { error } = await sb.from('profiles').update({ name:vals.name, bio:vals.bio }).eq('id', profile.id);
    if(error){ toast.error(error.message); return; }
    toast.success('Profile updated');
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input {...register('name',{required:true})} className="input w-full" onChange={()=>setDirty(true)} />
        {errors.name && <p className="text-xs text-red-600">Required</p>}
      </div>
      <div>
        <label className="block text-sm font-medium">Bio (max 55 chars)</label>
        <input {...register('bio',{maxLength:55})} className="input w-full" onChange={()=>setDirty(true)} />
      </div>
      <button type="submit" disabled={!dirty||isSubmitting} className="btn primary disabled:opacity-50">{isSubmitting?'Saving…':'Save'}</button>
    </form>
  );
} 