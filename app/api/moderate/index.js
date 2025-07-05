// /api/moderate/index.js
const sbAdmin = require('@/utils/supabase/admin').default;
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { kind, id } = req.body;                      // 'user' | 'event'

 const sb = sbAdmin;

  // ── grab the target row ─────────────────────────────────────────
  const table = kind === 'user' ? 'user_status' : 'events';
  const { data, error } = await sb.from(table).select('*').eq('id', id).single();
  if (error) return res.status(400).send(error.message);

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

  res.json({ ok: true });
};
