import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/utils/supabase/server";

/* GET /api/events — approved only */
export async function GET() {
  const sb = await createSupabaseServer();
  const { data, error } = await sb
    .from("events")
    .select("*")
    .eq("status", "approved")
    .order("starts_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

/* POST /api/events — new submission (status = "pending") */
export async function POST(req) {
  const sb = await createSupabaseServer();

  /* 1 — auth gate */
  const { data: { user }, error: userError } = await sb.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const session = { user };

  /* 2 — parse + minimal validation */
  const body = await req.json();
  for (const k of ["title", "vibe", "starts_at"]) {
    if (!body?.[k])
      return NextResponse.json({ error: `Missing "${k}"` }, { status: 400 });
  }

  /* 3 — whitelist to real columns only */
  const event = {
    host_id: session.user.id,
    title: body.title,
    description: body.description ?? "",
    vibe: String(body.vibe).toLowerCase(),
    address: body.address ?? "",
    starts_at: body.starts_at,
    ends_at: body.ends_at || null,
    status: "pending",
    img_path: body.img_path || null,
  };

  /* 4 — insert */
  const { data, error } = await sb
    .from("events")
    .insert([event])
    .select()
    .single(); // just one row expected

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  /* 5 — trigger moderation */
  try {
    console.log('Triggering moderation for new event:', data.id);
    const modResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'event', id: data.id }),
    });
    
    if (!modResponse.ok) {
      const modError = await modResponse.json();
      console.error('Moderation failed:', modError);
      
      // Delete the event since moderation failed
      await sb.from("events").delete().eq('id', data.id);
      
      // Return the moderation error to the frontend
      return NextResponse.json({ 
        error: modError.reason || 'Content moderation failed',
        moderationError: true 
      }, { status: 400 });
    } else {
      console.log('Moderation triggered successfully');
    }
  } catch (modError) {
    console.error('Moderation error:', modError);
    
    // Delete the event since moderation failed
    await sb.from("events").delete().eq('id', data.id);
    
    // Return the moderation error to the frontend
    return NextResponse.json({ 
      error: 'Content moderation failed - please try again',
      moderationError: true 
    }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
