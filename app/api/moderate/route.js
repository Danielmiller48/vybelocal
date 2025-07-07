// /app/api/moderate/route.js
import sbAdmin from '@/utils/supabase/admin';

// POST only
export async function POST(request) {
  const { kind, id } = await request.json();          // 'user' | 'event'
  console.log(`[MODERATION] Called for ${kind} ${id}`);

  const sb = sbAdmin;

  // ── grab the target row ─────────────────────────────────────────
  const table = kind === 'user' ? 'profiles' : 'events';
  const { data, error } = await sb.from(table).select('*').eq('id', id).single();
  if (error) {
    console.error('DB fetch error:', error);
    return new Response(error.message, { status: 400 });
  }

  // ── build text to moderate ─────────────────────────────────────
  const text =
    kind === 'user'
      ? `${data.name || ''} ${data.bio || ''}`
      : `${data.title || ''} ${data.description || ''}`;
  console.log('Moderation text:', text);

  // VybeLocal AI Content Moderation Cheat Sheet — Anti-Scam / Self-Promo Regex
  const scamPromoKeywords = [
    // 1. Link Dropping / Promo Handles
    "link in bio", "check my linktree", "onlyfans", "fansly", "my OF", "DM for rates", "book me", "inquiries via", "paid collab", "tap the link", "support me via", "full post here", "bit.ly", "linktr.ee", "bio.site", "beacons.ai",
    // 2. MLM / Hustle Recruiting
    "DM me to join", "who wants to make extra income", "6-figure mindset", "financial freedom", "boss babe", "hustle culture", "side hustle success", "be your own boss", "invest in yourself", "grind now, shine later",
    // 3. Scam/Clickbait
    "once-in-a-lifetime opportunity", "limited spots only", "guaranteed return", "this will change your life", "exclusive drop", "act fast", "urgent", "100% legit", "verified vendor", "make money fast",
    // 4. Pseudo-events / Bait
    "not a real event", "just vibes", "details in DM", "pull up if you know", "cashapp me to hold your spot", "drop your IG", "add me on snap",
    // 5. Sanitized Self-Promo
    "content creator meetup", "social media masterclass", "how to grow your brand", "engagement workshop", "photography collab", "brand building", "just networking"
  ];
  const scamPromoRegex = new RegExp(
    scamPromoKeywords.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|"),
    "i"
  );

  // Determine responsible user for the flag
  let responsibleUserId = null;
  if (kind === 'user') {
    responsibleUserId = id;
  } else if (kind === 'event') {
    // Look up event host_id
    const { data: eventRow } = await sb.from('events').select('host_id').eq('id', id).maybeSingle();
    responsibleUserId = eventRow?.host_id || null;
  }

  // VybeLocal custom scam/self-promo filter
  if (scamPromoRegex.test(text)) {
    let status = 'hidden';
    let severity = 3;
    let rejectionReason = 'Content violates community guidelines.';
    console.log('VybeLocal custom moderation: scam/self-promo detected');
    // Insert a flag for tracking repeat offenders
    await sb.from('flags').insert({
      target_type: kind,
      target_id: id,
      user_id: responsibleUserId,
      reporter_id: null, // AI system
      reason_code: 'scam_or_selfpromo',
      severity,
      details: { text, matched: 'scam/self-promo regex' },
    });
    return new Response(JSON.stringify({
      error: rejectionReason,
      status: status
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── OpenAI Moderation API ──────────────────────────────────────
  let mod;
  try {
    console.log('Calling OpenAI moderation API...');
    const openaiRes = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text, model: 'omni-moderation-latest' }),
    });
    mod = await openaiRes.json();
    console.log('OpenAI moderation response:', mod);
    if (mod.error) {
      console.error('OpenAI error:', mod.error);
      // Auto-approve when moderation fails (fail open for normal content)
      console.log('Moderation failed, auto-approving event');
      await sb.from(table).update({ status: 'approved', ai_score: null }).eq('id', id);
      return new Response(JSON.stringify({ ok: true, note: 'Auto-approved due to moderation failure' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!mod || !mod.results) {
      console.error('OpenAI moderation failed:', mod);
      // Auto-approve when moderation fails (fail open for normal content)
      console.log('Moderation failed, auto-approving event');
      await sb.from(table).update({ status: 'approved', ai_score: null }).eq('id', id);
      return new Response(JSON.stringify({ ok: true, note: 'Auto-approved due to moderation failure' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('OpenAI moderation error:', err);
    // Auto-approve when moderation fails (fail open for normal content)
    console.log('Moderation failed, auto-approving event');
    await sb.from(table).update({ status: 'approved', ai_score: null }).eq('id', id);
    return new Response(JSON.stringify({ ok: true, note: 'Auto-approved due to moderation failure' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const maxScore = Math.max(...Object.values(mod.results[0].category_scores));
  // Expanded regex for more 'fishy' content
  const promoRx = /(instagram|tiktok|onlyfans|linktr\.ee|discord|facebook|mlm|multi[- ]?level|pyramid scheme|cashapp|venmo|paypal|zelle|linktree|beacons\.ai|direct message|dm me|http[s]?:\/\/)/i;
  const hasPromo = promoRx.test(text);

  // ── status decision tree ───────────────────────────────────────
  let status = 'live';
  let severity = 1;
  let rejectionReason = null;
  
  if (maxScore >= 0.7 || (hasPromo && kind === 'event')) {
    status = 'hidden';
    severity = 3;
    rejectionReason = hasPromo ? 'Content contains promotional links or social media references' : 'Content flagged as inappropriate by AI moderation';
  } else if (maxScore >= 0.4 || hasPromo) {
    status = 'needs_review';
    severity = 2;
    rejectionReason = hasPromo ? 'Content contains promotional links or social media references' : 'Content flagged for review by AI moderation';
  }

  // ── auto-approve if AI says 'live' and kind is event ───────────
  if (kind === 'event' && status === 'live') {
    status = 'approved';
  }

  // ── auto-approve if AI says 'live' and kind is user ───────────
  if (kind === 'user' && status === 'live') {
    status = 'approved';
  }

  // ── If content is rejected, return error instead of flagging ──
  if (rejectionReason) {
    // Insert a flag for tracking repeat offenders
    await sb.from('flags').insert({
      target_type: kind,
      target_id: id,
      user_id: responsibleUserId,
      reporter_id: null, // AI system
      reason_code: 'ai_moderation',
      severity,
      details: { text, ai_result: mod },
    });
    console.log('Content rejected by moderation:', { status, rejectionReason });
    return new Response(JSON.stringify({ 
      error: 'Content moderation failed', 
      reason: rejectionReason,
      status: status 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── persist verdict (only for approved content) ────────────────────────────
  console.log('Updating event/user status:', { status, ai_score: maxScore });
  
  // Only update status for events (profiles don't have status column)
  if (kind === 'event') {
    const { data: updateData, error: updateError, count } = await sb
      .from(table)
      .update({ status, ai_score: maxScore, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    console.log('[MODERATION] Update result:', { updateData, updateError, count });
  } else {
    // For users, just log the moderation result
    console.log('User moderation result:', { status, ai_score: maxScore });
  }

  // ── insert AI flag into flags table (only for approved content) ────────────────────────────
  console.log('Inserting AI flag:', { kind, id, severity });
  await sb.from('flags').insert({
    target_type: kind,
    target_id: id,
    user_id: responsibleUserId,
    reporter_id: null, // AI system
    reason_code: 'ai_moderation',
    severity,
    details: mod,
  });

  // optional Slack ping on hard flag
  if (status === 'hidden') {
    console.log('Sending Slack notification for hard flag...');
    await fetch(process.env.SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `🚨 Hard flag on ${kind} ${id}` }),
    });
  }

  console.log(`[MODERATION] Complete for ${kind} ${id} — final status: ${status}`);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
