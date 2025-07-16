"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/utils/supabase/client";

const supabase = createSupabaseBrowser();

/* schema mirrors HostNewForm but all optional because editing */
const schema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().max(280).optional(),
  vibe: z.enum(["chill", "hype", "creative", "active"]).optional(),
  address: z.string().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().nullable().optional(),
  img_file: z.any().optional(),
  refund_policy: z.enum(["anytime","1week","48h","24h","no_refund"]).optional(),
  price_in_cents: z.number().int().min(0).optional(),
  rsvp_capacity: z
    .preprocess(
      (v) => (v === '' || v === null || Number.isNaN(v)) ? undefined : Number(v),
      z.number().int().min(1).optional()
    ),
});

export default function HostEditForm({ event }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState(
    event.img_path ? supabase.storage.from("event-images").getPublicUrl(event.img_path).data.publicUrl : null
  );
  const [paidToggle,setPaidToggle]=useState(Boolean(event.price_in_cents));

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: event.title,
      description: event.description,
      vibe: event.vibe,
      address: event.address,
      starts_at: event.starts_at?.slice(0, 16),
      ends_at: event.ends_at?.slice(0, 16),
      refund_policy: event.refund_policy ?? "no_refund",
      price_in_cents: event.price_in_cents ? event.price_in_cents / 100 : undefined,
      rsvp_capacity: event.rsvp_capacity ?? undefined,
    },
  });

  useEffect(() => {
    const sub = watch((vals, { name }) => {
      if (name === "starts_at" && vals.starts_at && !vals.ends_at) {
        setValue("ends_at", vals.starts_at, { shouldValidate: true });
      }
    });
    return () => sub.unsubscribe();
  }, [watch, setValue]);

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      setValue("img_file", file);
    }
  }

  async function onSubmit(values) {
    startTransition(async () => {
      let uploadedPath = event.img_path;
      if (values.img_file) {
        const fileName = `${crypto.randomUUID()}_${values.img_file.name}`;
        const { error } = await supabase.storage
          .from("event-images")
          .upload(fileName, values.img_file, { cacheControl: "3600", upsert: false });
        if (error) return alert(error.message);
        uploadedPath = fileName;
      }

      const baseCents = paidToggle ? Math.round((values.price_in_cents || 0)*100) : null;

      const payload = {
        ...values,
        img_path: uploadedPath,
        price_in_cents: baseCents,
        refund_policy: paidToggle ? values.refund_policy ?? event.refund_policy : 'no_refund',
        rsvp_capacity: (values.rsvp_capacity === '' || Number.isNaN(values.rsvp_capacity)) ? null : values.rsvp_capacity,
        status: "pending", // always revert to pending
      };

      // remove undefined keys
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(()=>({}));
      if (!res.ok || json.error) {
        return alert(json.error || "Update failed");
      }
      router.push("/host?updated=1");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col space-y-4">
      <input placeholder="Title" {...register("title")} className="input" />
      {errors.title && <p className="text-red-500 text-sm">{errors.title.message}</p>}

      <textarea placeholder="Description" {...register("description")} className="textarea" />

      <select {...register("vibe")} className="select">
        <option value="chill">Chill</option>
        <option value="hype">Hype</option>
        <option value="creative">Creative</option>
        <option value="active">Active</option>
      </select>

      {/* Paid toggle */}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={paidToggle} onChange={e=>setPaidToggle(e.target.checked)} disabled={event.locked} />
        Paid event
      </label>

      {paidToggle && (
        <>
          <input type="number" min="0.5" step="0.01" placeholder="Ticket price USD" {...register("price_in_cents", { valueAsNumber: true })} className="input" disabled={event.locked} />
          {event.locked && <p className="text-xs text-gray-500">Price locked after paid RSVPs.</p>}

          <select {...register("refund_policy") } className="select" disabled={event.locked}>
            <option value="anytime">Refund anytime</option>
            <option value="1week">Refund until 1 week before start</option>
            <option value="48h">Refund until 48 h before start</option>
            <option value="24h">Refund until 24 h before start</option>
            <option value="no_refund">No refunds</option>
          </select>
        </>
      )}

      <input placeholder="Address" {...register("address")} className="input" />

      <input type="number" placeholder="RSVP capacity (leave blank)" {...register("rsvp_capacity", { valueAsNumber: true })} className="input" disabled={event.locked} />

      <div className="flex flex-col space-y-2">
        <label className="text-sm">Event Start</label>
        <input type="datetime-local" {...register("starts_at")} className="input" />
        <label className="text-sm">Event End</label>
        <input type="datetime-local" {...register("ends_at")} className="input" />
      </div>

      <label className="flex flex-col border border-dashed p-4 text-center cursor-pointer">
        {preview ? <img src={preview} className="h-40 object-cover" /> : "Change image"}
        <input type="file" accept="image/*" hidden onChange={onFileChange} />
      </label>

      <button disabled={isPending} className="btn primary">
        {isPending ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
