// ─── app/admin/dashboard/actions.js ───
"use server";

import { revalidatePath } from "next/cache";
import { createClient }   from "@supabase/supabase-js";

// Service-role client — bypasses RLS
const sbAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/* ───────── approve / reject ───────── */
export async function decideEvent(id, approve) {
  /* 1️⃣ fetch event first (need host_id for audit / e-mail later) */
  const { data: ev, error: evErr } = await sbAdmin
    .from("events")
    .select("host_id, title, img_path")
    .eq("id", id)
    .single();
  if (evErr || !ev) throw evErr || new Error("Event not found");

  /* 2️⃣ update status */
  const newStatus = approve ? "approved" : "rejected";
  await sbAdmin.from("events")
    .update({ status: newStatus })
    .eq("id", id);

  /* 3️⃣ audit trail */
  await sbAdmin.from("mod_actions").insert({
    target_id   : id,
    target_type : "event",
    action      : approve ? "approve" : "reject",
  });

  /* 4️⃣ revalidate */
  revalidatePath("/admin/dashboard");
  revalidatePath("/vybes");
}

/* ───────── send back to PENDING (or any status) ───────── */
export async function setEventStatus(id, status = "pending") {
  await sbAdmin.from("events")
    .update({ status })
    .eq("id", id);

  await sbAdmin.from("mod_actions").insert({
    target_id   : id,
    target_type : "event",
    action      : `set_${status}`,         // e.g.  set_pending
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/vybes");
}

/* ───────── hard-delete row + image ───────── */
export async function deleteEvent(id) {
  /* grab image key before row disappears */
  const { data: ev } = await sbAdmin
    .from("events")
    .select("img_path")
    .eq("id", id)
    .maybeSingle();

  await sbAdmin.from("events").delete().eq("id", id);

  if (ev?.img_path) {
    await sbAdmin.storage
      .from("event-images")
      .remove([ev.img_path]);
  }

  revalidatePath("/admin/dashboard");
}
