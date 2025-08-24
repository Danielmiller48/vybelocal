import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';
import { getUserIdFromJwt } from '@/utils/auth';
import { sendEmail } from '@/utils/email.js';

export async function PATCH(req, ctx) {
  const { id: reviewId } = await ctx.params;

  let action, note;
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    action = body.action;
    note   = body.note;
  } else {
    // assume form-urlencoded (HTML form)
    const form = await req.formData().catch(()=>null);
    if (form) {
      action = form.get('action');
      note   = form.get('note');
    }
  }

  if (!['approve','strike','flag'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const sb = await createSupabaseServer({ admin: true });
  // Get moderator id
  const modId = await getUserIdFromJwt(req);
  const { data: modProfile } = await sb.from('profiles').select('is_admin,name').eq('id', modId).maybeSingle();
  if (!modProfile?.is_admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  // fetch review row to know host/event
  const { data: review, error: revErr } = await sb
    .from('ai_cancellation_reviews')
    .select('event_id, host_id')
    .eq('id', reviewId)
    .maybeSingle();
  if (revErr || !review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

  const updates = {
    reviewed_by: modId,
    moderator_override: action !== 'approve',
    final_strike_applied: action === 'strike',
    mod_note: note ?? null,
  };

  const { error: upErr } = await sb
    .from('ai_cancellation_reviews')
    .update(updates)
    .eq('id', reviewId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  if (action === 'strike') {
    await sb.from('host_cancel_strikes').insert({ host_id: review.host_id, event_id: review.event_id });
  }
  if (action === 'flag') {
    await sb.from('flags').insert({
      target_type: 'user',
      target_id: review.host_id,
      reason_code: 'ai_cancellation',
      reporter_id: modId,
      severity: 2,
      details: { review_id: reviewId },
    });
  }

  // Notify host via in-app notification and email
  if (note) {
    // in-app notification
    await sb.from('notifications').insert({
      user_id: review.host_id,
      title: 'Cancellation review outcome',
      message: note,
    });

    // email (best-effort – don’t fail request)
    try {
      const { data: hostProfile } = await sb
        .from('profiles')
        .select('email,name')
        .eq('id', review.host_id)
        .maybeSingle();

      if (hostProfile?.email) {
        // Fetch event title for context
        const { data: eventData } = await sb
          .from('events')
          .select('title, starts_at')
          .eq('id', review.event_id)
          .maybeSingle();

        const decision = action === 'strike'
          ? 'Strike Applied'
          : action === 'approve'
            ? 'No Strike'
            : 'Flagged for Monitoring';

        // Format date/time nicely
        const dt = eventData?.starts_at ? new Date(eventData.starts_at).toLocaleString('en-US', { dateStyle:'medium', timeStyle:'short' }) : review.event_id;

        const hostFirst = hostProfile?.name?.split(' ')[0] || 'there';
        const adminFirst = modProfile?.name?.split(' ')[0] || 'A moderator';

        const emailText = `Hey ${hostFirst},

Thanks for keeping us in the loop. Our trust team has reviewed your recent same-day cancellation for:

📅 ${eventData?.title || 'your event'}
🕒 ${dt}

VybeLocal is built around community trust and showing up for each other—so we take cancellations seriously, but we also know that life (and weather) happens.

🧠 Here's what we decided:

Decision: ${decision}
Reviewed by: ${adminFirst}
Note from our team:
"${note}"

Thanks for helping us keep VybeLocal real, respectful, and reliable.

— The VybeLocal Team`;

        await sendEmail({
          to: hostProfile.email,
          subject: 'Update on your event cancellation',
          text: emailText,
        });
      }
    } catch (err) {
      console.error('Email send error', err);
    }
  }

  return NextResponse.json({ ok: true });
}

// Alias so plain HTML forms (which only support POST) can call this endpoint
export async function POST(req, ctx) {
  const res = await PATCH(req, ctx);
  // For browser form posts (not JS fetch) redirect back to list
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return NextResponse.redirect(new URL('/admin/cancellations', req.url));
  }
  return res;
} 