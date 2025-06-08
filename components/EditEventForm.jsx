// components/EditEventForm.jsx
'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  title:       z.string().min(3).max(60),
  description: z.string().max(280).optional(),
  starts_at:   z.string(),           // <input type="datetime-local">
  vibe:        z.enum(['chill', 'creative', 'active', 'hype'])
});

export default function EditEventForm({ event }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title:       event.title,
      description: event.description ?? '',
      starts_at:   event.starts_at.slice(0, 16), // ISO → yyyy-MM-ddTHH:mm
      vibe:        event.vibe
    }
  });

  async function onSubmit(data) {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => fd.append(k, v));
    await fetch(`/host/events/${event.id}/actions`, {
      method: 'POST',
      body: fd
    });
    // simple UX: reload path so RSC revalidates
    location.reload();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm mb-1">Title</label>
        <input {...register('title')} className="input" />
        {errors.title && <p className="text-red-500 text-xs">{errors.title.message}</p>}
      </div>

      <div>
        <label className="block text-sm mb-1">Description</label>
        <textarea {...register('description')} rows={3} className="input" />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm mb-1">Starts</label>
          <input type="datetime-local" {...register('starts_at')} className="input" />
        </div>

        <div>
          <label className="block text-sm mb-1">Vibe</label>
          <select {...register('vibe')} className="input">
            <option value="chill">Chill</option>
            <option value="creative">Creative</option>
            <option value="active">Active</option>
            <option value="hype">Hype</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary"
      >
        {isSubmitting ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
