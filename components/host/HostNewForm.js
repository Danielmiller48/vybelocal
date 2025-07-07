"use client";

// ↑ add these 2 lines right at the top of the file
export const runtime     = "nodejs";   // switch off the 1 MB Edge limit
export const maxBodySize = 10 * 1024 * 1024; // 10 MB (adjust as you like)

import { createSupabaseBrowser } from "@/utils/supabase/client";
import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";

const schema = z.object({
  title: z.string().min(3, "Title too short").max(60),
  vibe: z.enum(["chill", "hype", "creative", "active"]),
  description: z.string().max(280).optional(),
  starts_at: z.string(),
  ends_at: z.string().optional(),
  address: z.string().max(120).optional(),
  image: z
    .custom(
      (val) => val === undefined || (val instanceof FileList && val.length === 1),
      "Select exactly one image"
    )
    .optional(),
});

export default function HostNewForm() {
  const { data: session } = useSession();
  const router = useRouter();

  const [suggestions, setSuggestions] = useState([]);
  const [serverErr, setErr] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [thumb, setThumb] = useState("");

  const prevStartRef = useRef(""); // for copy-over logic
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { vibe: "chill" },
  });

  /* ───────── live field watches ───────── */
  const addr   = watch("address");
  const fileLs = watch("image");
  const start  = watch("starts_at");
  const end    = watch("ends_at");

  /* ─── thumbnail preview ─── */
  useEffect(() => {
    if (!fileLs?.length) {
      setThumb("");
      return;
    }
    const url = URL.createObjectURL(fileLs[0]);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [fileLs]);

  /* ─── copy start → end if end is blank OR followed prior start ─── */
  useEffect(() => {
    if (!start) return;
    // copy only if end is empty OR matched the previous start
    if (!end || end === prevStartRef.current) {
      setValue("ends_at", start, { shouldValidate: false, shouldDirty: true });
    }
    prevStartRef.current = start;
  }, [start]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───────── Mapbox autocomplete ───────── */
  useEffect(() => {
    if (!addr?.trim() || !mapboxToken) return;
    const ctl = new AbortController();

    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        addr
      )}.json?access_token=${mapboxToken}&autocomplete=true&limit=5`,
      { signal: ctl.signal }
    )
      .then((r) => r.json())
      .then((d) => setSuggestions(d.features ?? []))
      .catch(() => {});

    return () => ctl.abort();
  }, [addr, mapboxToken]);

  function useMyLocation() {
    if (!navigator.geolocation || !mapboxToken) return;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const r = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.longitude},${coords.latitude}.json?access_token=${mapboxToken}&limit=1`
        );
        const d = await r.json();
        const place = d.features?.[0]?.place_name;
        if (place) setValue("address", place);
      } catch {
        /* ignore */
      }
    });
  }

  /* ───────── image upload helper ───────── */
  async function uploadImage(file) {
  if (!file) return null;
  const sb       = createSupabaseBrowser();       // ← direct client
  const filename = `${uuid()}-${file.name}`;

  const { error } = await sb.storage
    .from("event-images")
    .upload(filename, file, { upsert: false });

  if (error) throw new Error(error.message);
  return filename;                                // store in img_path
}

  /* ───────── submit ───────── */
  function onSubmit(vals) {
    setErr("");
    startSubmit(async () => {
      try {
        const img_path = vals.image ? await uploadImage(vals.image[0]) : null;

        const payload = {
          host_id: session?.user?.id ?? null,
          title: vals.title,
          vibe: vals.vibe,
          description: vals.description ?? null,
          address: vals.address ?? null,
          starts_at: vals.starts_at,
          ends_at: vals.ends_at || null,
          img_path,
          status: "pending",
        };

        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          
          // Check if it's a moderation error
          if (j.moderationError) {
            toast.error(`Content moderation failed: ${j.error}`);
            setErr(j.error);
          } else {
            throw new Error(j?.error || "Submission failed");
          }
          return;
        }
        
        toast.success("Event created successfully! 🎉");
        router.replace("/host?created=1");
      } catch (e) {
        setErr(e.message);
        toast.error(e.message);
      }
    });
  }

  /* ───────── UI ───────── */
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Event Title
        </label>
        <input id="title" {...register("title")} className="input w-full" />
        {errors.title && <p className="err">{errors.title.message}</p>}
      </div>

      {/* Vibe */}
      <div>
        <label htmlFor="vibe" className="block text-sm font-medium text-gray-700">
          Vibe
        </label>
        <select id="vibe" {...register("vibe")} className="select w-full">
          <option value="chill">Chill</option>
          <option value="hype">Hype</option>
          <option value="creative">Creative</option>
          <option value="active">Active</option>
        </select>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          {...register("description")}
          className="textarea w-full"
          rows={3}
        />
        {errors.description && <p className="err">{errors.description.message}</p>}
      </div>

      {/* Address */}
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700">
          Address
        </label>
        <input
          id="address"
          list="addr-suggestions"
          {...register("address")}
          className="input w-full"
          autoComplete="off"
        />
        <datalist id="addr-suggestions">
          {suggestions.map((f) => (
            <option key={f.id} value={f.place_name} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={useMyLocation}
          className="mt-1 text-indigo-600 text-sm hover:underline"
        >
          Use My Location
        </button>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="starts_at" className="block text-sm font-medium text-gray-700">
            Event Start
          </label>
          <input
            id="starts_at"
            type="datetime-local"
            {...register("starts_at")}
            className="input w-full"
          />
        </div>
        <div>
          <label htmlFor="ends_at" className="block text-sm font-medium text-gray-700">
            Event End
          </label>
          <input
            id="ends_at"
            type="datetime-local"
            {...register("ends_at")}
            className="input w-full"
          />
        </div>
      </div>

      {/* Image */}
      <div>
        <label
          htmlFor="image"
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition"
        >
          <span>Click to select an image</span>
          <input id="image" type="file" accept="image/*" {...register("image")} className="hidden" />
          {thumb && (
            <img src={thumb} alt="preview" className="h-24 w-auto rounded-md object-cover" />
          )}
        </label>
        {errors.image && <p className="err">{errors.image.message}</p>}
      </div>

      {serverErr && <p className="err">{serverErr}</p>}

      <button type="submit" disabled={submitting} className="btn primary w-full">
        {submitting ? "Submitting…" : "Create Event"}
      </button>
    </form>
  );
}
