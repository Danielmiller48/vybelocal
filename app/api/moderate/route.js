// /app/api/moderate/route.js
import sbAdmin from '@/utils/supabase/admin';
import fetch from 'node-fetch';

// POST only
export async function POST(request) {
  const { kind, id } = await request.json();          // 'user' | 'event'

 const sb = sbAdmin;

  // ── grab the target row ─────────────────────────────────────────
  const table = kind === 'user' ? 'user_status' : 'events';
  const { data, error } = await sb.from(table).select('*').eq('id', id).single();
  if (error) return new Response(error.message, { status: 400 });

  // ── build text to moderate ─────────────────────────────────────
  const text =
    kind === 'user'
      ? `${data.full_name || ''} ${data.bio || ''}`
      : `${data.title || ''} ${data.description || ''}`;

  // ── OpenAI Moderation API ──────────────────────────────────────
  const mod = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: text }),
  }).then((r) => r.json());

  const maxScore = Math.max(...Object.values(mod.results[0].category_scores));
  const promoRx = /(instagram|tiktok|onlyfans|linktr\.ee|discord|facebook)/i;
  const hasPromo = promoRx.test(text);

  // ── status decision tree ───────────────────────────────────────
  let status = 'live';
  if (maxScore >= 0.7 || (hasPromo && kind === 'event')) status = 'hidden';
  else if (maxScore >= 0.4 || hasPromo) status = 'needs_review';

  // ── persist verdict ────────────────────────────────────────────
  await sb
    .from(table)
    .update({ status, ai_score: maxScore, updated_at: sb.rpc('now') })
    .eq('id', id);

  // optional Slack ping on hard flag
  if (status === 'hidden') {
    await fetch(process.env.SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `🚨 Hard flag on ${kind} ${id}` }),
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
