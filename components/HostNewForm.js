'use client';

import { useEffect, useRef }   from 'react';
import { useForm }             from 'react-hook-form';
import { zodResolver }         from '@hookform/resolvers/zod';
import { z }                   from 'zod';
import supabase                from '@/utils/supabase/browser';   // ✅ correct import
import { useSession }          from 'next-auth/react';
import { useRouter }           from 'next/navigation';
import { v4 as uuid }          from 'uuid';
import AddressInput            from '@/components/AddressInput';

/* ───────── schema ───────── */
const schema = z.object({
  title:       z.string().min(3).max(60),
  vibe:        z.enum(['chill','hype','creative','active']),
  description: z.string().max(280).optional(),
  starts_at:   z.string(),
  ends_at:     z.string().optional(),
  address:     z.string().min(3),
  image: z.custom(
    (val) =>
      val === undefined ||
      (val instanceof FileList &&
        (val.length === 0 || (val.length > 0 && val[0] instanceof File))),
    { message: 'Must select an image file.' }
  ).optional(),
});
/* ────────────────────────── */

/* helper uploads to private bucket & returns key */
async function uploadImage(file) {
  const ext      = file.name.split('.').pop();
  const filePath = `${uuid()}/${uuid()}.${ext}`;

  const { error } = await supabase
    .storage
    .from('event-images')
    .upload(filePath, file);

  if (error) throw error;
  return filePath;
}

export default function HostNewForm() {
  const { data: session, status } = useSession(); // NextAuth
  const router  = useRouter();
  const alerted = useRef(false);

  /* -------- bridge NextAuth → Supabase -------- */
  useEffect(() => {
    if (
      status === 'authenticated' &&
      session?.supabaseAccessToken &&
      // avoid resetting if SB already has a user
      !supabase.auth.getUser().data.user
    ) {
      supabase.auth.setSession({
        access_token : session.supabaseAccessToken,
        refresh_token: session.supabaseRefreshToken ?? null
      }).catch(() => {}); // silent fail
    }
  }, [status, session]);

  /* -------- auth guard -------- */
  useEffect(() => {
    if (status === 'unauthenticated' && !alerted.current) {
      alerted.current = true;
      window.alert('Almost there — please sign in to host an event.');
      router.replace('/login?next=/host/new');
    }
  }, [status, router]);

  if (status !== 'authenticated') return null;

  /* -------- form hooks -------- */
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  /* -------- optional GPS autofill -------- */
  async function autofillLocation() { /* unchanged, omitted for brevity */ }

  /* -------- submit handler -------- */
  const onSubmit = async (form) => {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) { alert(userErr?.message || 'User not found'); return; }

    let img_path = null;
    if (form.image?.length) {
      try { img_path = await uploadImage(form.image[0]); }
      catch (err) { alert(`Upload failed: ${err.message}`); return; }
    }

    const { error } = await supabase.from('events').insert({
      host_id   : user.id,
      title     : form.title,
      description: form.description,
      vibe      : form.vibe,
      address   : form.address,
      starts_at : form.starts_at,
      ends_at   : form.ends_at || null,
      img_path,
      status    : 'pending',
    });

    if (error) { alert(`Insert failed: ${error.message}`); return; }
    router.push('/host/tools?submitted=1');
  };

  /* -------- UI -------- */
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-lg space-y-4 p-6">
      <input {...register('title')} placeholder="Event title" className="input w-full" />

      <select {...register('vibe')} className="select w-full">
        <option value="">Pick a vibe</option>
        <option value="chill">Chill</option>
        <option value="hype">Hype</option>
        <option value="creative">Creative</option>
        <option value="active">Active</option>
      </select>

      <input type="datetime-local" {...register('starts_at')} className="input w-full" />

      <div>
        <label className="text-sm font-medium block mb-1">Location</label>
        <AddressInput
          onChange={(val) => setValue('address', val, { shouldValidate: true })}
        />
        <button type="button" onClick={autofillLocation} className="mt-2 text-sm text-blue-600 hover:underline">
          Use my current location
        </button>
      </div>

      <textarea {...register('description')} placeholder="Description" className="textarea w-full" />

      <input type="file" accept="image/*" {...register('image')} />

      <button disabled={isSubmitting} className="btn-primary w-full" type="submit">
        {isSubmitting ? 'Submitting…' : 'Submit for Review'}
      </button>

      {Object.values(errors).map((e) => (
        <p key={e.message} className="text-red-500 text-sm">{e.message}</p>
      ))}
    </form>
  );
}
