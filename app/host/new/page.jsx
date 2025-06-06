'use client';

import { useEffect, useRef } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

/* ────────── Zod schema ────────── */
const schema = z.object({
  title:       z.string().min(3, 'Title too short').max(60),
  vibe:        z.enum(['chill', 'hype', 'creative', 'active']),
  description: z.string().max(280).optional(),
  starts_at:   z.string(),
  ends_at:     z.string().optional(),
  address:     z.string().max(120).optional(),
  image: z
    .custom(
      (val) =>
        val === undefined ||
        (val instanceof FileList &&
         val.length === 0 ||
         val.length > 0 && val [0] instanceof File),
      { message: 'Must select an image file.' }
    )
    .optional(),
});
/* ──────────────────────────────── */

export default function HostNew() {
  const { status }  = useSession();
  const supabase    = useSupabaseClient();
  const router      = useRouter();
  const alertedOnce = useRef(false);

  /* Guard */
  useEffect(() => {
    if (status === 'unauthenticated' && !alertedOnce.current) {
      alertedOnce.current = true;
      window.alert('Almost there — please sign in to host an event.');
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading' || status === 'unauthenticated') return null;

  /* Form */
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) { alert(userErr.message); return; }
    if (!user)   { alert('User not found.'); return; }

    /* Optional image upload */
    let image_url = null;
    const BUCKET = process.env.NEXT_PUBLIC_EVENT_BUCKET || 'event-images';

    if (data.image?.length) {                       // ← only when a file was chosen
      const filePath = `${user.id}/${uuid()}`;
      const { error: upErr } = await supabase
        .storage
        .from(BUCKET)
        .upload(filePath, data.image[0], { upsert: false });
      if (upErr) {
        console.error('Upload error ⇣', upErr);
        alert(`Upload failed: ${upErr.message}`);
        return;
      }

      image_url = supabase
        .storage
        .from(BUCKET)
        .getPublicUrl(filePath).data.publicUrl;
    }

    /* DB insert */
    const { error } = await supabase.from('events').insert({
      host_id:     user.id,
      title:       data.title,
      description: data.description,
      vibe:        data.vibe,
      address:     data.address,
      starts_at:   data.starts_at,
      ends_at:     data.ends_at || null,
      image_url,                              // null if no image
    });

    if (error) {
      console.error('Insert error ⇣', error);
      alert(`Insert failed: ${error.message}`);
      return;
    }

    router.push('/host/tools?submitted=1');
  };

  /* JSX */
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto max-w-lg space-y-4 p-6"
    >
      <input {...register('title')} placeholder="Event title" className="input w-full" />

      <select {...register('vibe')} className="select w-full">
        <option value="">Pick a vibe</option>
        <option value="chill">Chill</option>
        <option value="hype">Hype</option>
        <option value="creative">Creative</option>
        <option value="active">Active</option>
      </select>

      <input type="datetime-local" {...register('starts_at')} className="input w-full" />

      <textarea {...register('description')} placeholder="Description" className="textarea w-full" />

      <input type="file" accept="image/*" {...register('image')} />

      <button disabled={isSubmitting} className="btn-primary w-full" type="submit">
        {isSubmitting ? 'Submitting…' : 'Submit for Review'}
      </button>

      {Object.values(errors).map((e) => (
        <p key={e.message} className="text-red-500 text-sm">
          {e.message}
        </p>
      ))}
    </form>
  );
}
