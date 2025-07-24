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
import { calcFees } from "@/lib/fees";
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
  refund_policy: z.enum(["anytime","1week","48h","24h","no_refund"]),
  price_in_cents: z.number().int().min(0).optional(),
  rsvp_capacity: z
    .preprocess(
      (v) => (v === '' || v === null || Number.isNaN(v)) ? undefined : Number(v),
      z.number().int().min(1).optional()
    ),
  image: z
    .custom(
      (val) => val === undefined || (val instanceof FileList && val.length === 1),
      "Select exactly one image"
    )
    .optional(),
}).superRefine((vals,ctx)=>{
  if(vals.starts_at && vals.ends_at){
    const s = new Date(vals.starts_at);
    const e = new Date(vals.ends_at);
    if(e - s < 60*60*1000){
      ctx.addIssue({ code:'custom', path:['ends_at'], message:'Events are locked to a 1-hour minimum — don’t worry if yours wraps early. We won’t tell anyone.' });
    }
  }
});

export default function HostNewForm() {
  const { data: session } = useSession();
  const router = useRouter();

  const [suggestions, setSuggestions] = useState([]);
  const [serverErr, setErr] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [thumb, setThumb] = useState("");
  const [paid, setPaid] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingVals, setPendingVals] = useState(null);

  /* ─── fetch strike count once session available ─── */
  useEffect(()=>{
    if(!session?.user?.id) return;
    (async()=>{
      const sb = createSupabaseBrowser();
      const { data, error } = await sb
        .from('v_host_strikes_last6mo')
        .select('strike_count')
        .eq('host_id', session.user.id)
        .maybeSingle();
      if(!error && data){
        setStrikeCount(data.strike_count ?? 0);
      }
    })();
  },[session?.user?.id]);

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
    defaultValues: { vibe: "chill", refund_policy: "no_refund", price_in_cents: undefined },
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
      const dt = new Date(start);
      if (!Number.isNaN(dt.getTime())) {
        dt.setHours(dt.getHours() + 1);
        const localStr = toInputValue(dt);
        setValue("ends_at", localStr, { shouldValidate: false, shouldDirty: true });
      }
    } else {
      // ensure minimum duration
      const s = new Date(start);
      const e = new Date(end);
      if(e - s < 60*60*1000){
        const dt = new Date(s.getTime()+60*60*1000);
        const localStr = toInputValue(dt);
        setValue('ends_at', localStr, { shouldValidate:false, shouldDirty:true });
      }
    }
    prevStartRef.current = start;
  }, [start]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───────── Mapbox autocomplete ───────── */
  useEffect(() => {
    if (!addr || addr.trim().length < 3 || !mapboxToken) {
      setSuggestions([]);
      return;
    }

    const ctl = new AbortController();
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addr)}.json?autocomplete=true&limit=5&access_token=${mapboxToken}`;

    fetch(url, { signal: ctl.signal })
      .then((r) => r.json())
      .then((d) => setSuggestions(d.features ?? []))
      .catch(() => {/* ignore */});

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
    // If host has at least one prior guest-attended cancellation, show warning modal first
    if (strikeCount >= 1) {
      setPendingVals(vals);
      setConfirmOpen(true);
      return;
    }
    submitEvent(vals);
  }

  function submitEvent(vals){
    startSubmit(async () => {
      try {
        const img_path = vals.image ? await uploadImage(vals.image[0]) : null;

        const baseCents = paid ? Math.round((vals.price_in_cents || 0) * 100) : null;

        const toUtcIso = (s)=> new Date(s).toISOString();

        const payload = {
          host_id: session?.user?.id ?? null,
          title: vals.title,
          vibe: vals.vibe,
          description: vals.description ?? null,
          address: vals.address ?? null,
          starts_at: toUtcIso(vals.starts_at),
          ends_at: vals.ends_at ? toUtcIso(vals.ends_at) : null,
          refund_policy: paid ? vals.refund_policy : "no_refund",
          price_in_cents: baseCents,
          rsvp_capacity: (vals.rsvp_capacity === '' || Number.isNaN(vals.rsvp_capacity)) ? null : vals.rsvp_capacity,
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

  /* modal confirm handlers */
  function handleModalConfirm(){
    if(!pendingVals) return;
    setConfirmOpen(false);
    submitEvent(pendingVals);
    setPendingVals(null);
  }
  function handleModalCancel(){
    setConfirmOpen(false);
    setPendingVals(null);
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

      {/* Paid toggle */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={paid}
          onChange={(e)=>setPaid(e.target.checked)}
        />
        Paid event
      </label>

      {paid && (
        <>
      {/* Ticket Price */}
      <div>
        <label htmlFor="price_in_cents" className="block text-sm font-medium text-gray-700">Ticket Price (USD)</label>
        <input id="price_in_cents" type="number" min="0.5" step="0.01" {...register("price_in_cents", { valueAsNumber: true })} className="input w-full" placeholder="e.g. 5.00" />
        {errors.price_in_cents && <p className="err">{errors.price_in_cents.message}</p>}
      </div>

      {/* Refund Policy */}
      <div>
        <label htmlFor="refund_policy" className="block text-sm font-medium text-gray-700">Refund policy</label>
        <select id="refund_policy" {...register("refund_policy")} className="select w-full">
          <option value="anytime">Refund anytime</option>
          <option value="1week">Refund until 1 week before start</option>
          <option value="48h">Refund until 48 h before start</option>
          <option value="24h">Refund until 24 h before start</option>
          <option value="no_refund">No refunds</option>
        </select>
      </div>
        </>
      )}

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

      {/* RSVP Capacity */}
      <div>
        <label htmlFor="rsvp_capacity" className="block text-sm font-medium text-gray-700">
          RSVP Capacity (optional)
        </label>
        <input
          id="rsvp_capacity"
          type="number"
          {...register("rsvp_capacity", { valueAsNumber: true })}
          className="input w-full"
          placeholder="Leave blank for unlimited"
        />
        {errors.rsvp_capacity && <p className="err">{errors.rsvp_capacity.message}</p>}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="starts_at" className="block text-sm font-medium text-gray-700">Event Start</label>
          <input id="starts_at" type="datetime-local" {...register('starts_at')} className="input w-full" />
        </div>
        <div>
          <label htmlFor="ends_at" className="block text-sm font-medium text-gray-700">Event End</label>
          <input id="ends_at" type="datetime-local" {...register('ends_at')} className="input w-full" />
          {errors.ends_at && <p className="err">{errors.ends_at.message}</p>}
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

      {/* second strike modal */}
      {confirmOpen && pendingVals && (
        (()=>{
          const priceCents = paid ? Math.round((pendingVals.price_in_cents || 0) * 100) : 0;
          const capacity = pendingVals.rsvp_capacity || null;
          const feePer = priceCents ? calcFees(priceCents).stripe : 0;
          const penalty = capacity && feePer ? ((feePer*capacity)/100).toFixed(2) : '0.00';
          return (
            <SecondStrikeModal
              open={confirmOpen}
              onConfirm={handleModalConfirm}
              onCancel={handleModalCancel}
              priceCents={priceCents}
              capacity={capacity}
              penalty={penalty}
              feePer={feePer}
            />
          );
        })()
      )}
    </form>
  );
}

/* ───────── Second-strike modal ───────── */
function SecondStrikeModal({ open, onConfirm, onCancel, priceCents, capacity, penalty, feePer }) {
  if (!open) return null;
  const price = (priceCents/100).toFixed(2);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold">You’re about to go live.</h2>
        <p className="text-sm whitespace-pre-wrap text-gray-700">
Thanks for putting something out into the world — we back creators who show up.

Quick heads-up: you’ve already cancelled one event after people commited to the plan.
If you cancel this one too, you’ll have to cover Stripe’s processing fees on any paid tickets.

{feePer ? `Each paid RSVP costs $${(feePer/100).toFixed(2)} in non-refundable Stripe fees.` : ``}

Not sure you can follow through? It’s okay to hold off.
When you post, we assume you’re ready.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm">Never mind</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm">Publish event</button>
        </div>
      </div>
    </div>
  );
}

// helper: convert Date to yyyy-MM-ddTHH:mm for datetime-local respecting local tz
function toInputValue(date){
  const off = date.getTimezoneOffset();
  const local = new Date(date.getTime() - off*60000);
  return local.toISOString().slice(0,16);
}
