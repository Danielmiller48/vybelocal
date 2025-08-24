// AI Insights Service for Analytics
// Provides real AI-generated insights for event analytics data using OpenAI
// with VybeLocal's authentic voice and microcopy

// TODO: Add your OpenAI API key to environment variables
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Lightweight cache and backoff to reduce API calls
let MemCache = new Map(); // key -> { at, result }
let InFlight = new Map(); // key -> Promise
const MEM_TTL_MS = 24 * 60 * 60 * 1000;

const stableHash = (obj) => {
  try {
    const s = JSON.stringify(obj);
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return h.toString(36);
  } catch { return String(Date.now()); }
};

async function withBackoff(fn) {
  let delay = 800, lastErr;
  for (let i = 0; i < 2; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const status = e?.status || e?.response?.status || /\b(429)\b/.test(String(e)) ? 429 : 0;
      if (status !== 429) throw e;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw lastErr;
}

/**
 * Generate AI insights for analytics charts
 * @param {string} chartType - Type of chart (capacity, revenue, rsvp, etc.)
 * @param {Object} data - Chart data and metrics
 * @param {Object} context - Additional context (user info, time period, etc.)
 * @returns {Promise<Object>} AI-generated insight with message, recommendation, and metadata
 */
const generateAIInsight = async (chartType, data, context = {}) => {
  try {
    // Use real OpenAI for insights
    return await withBackoff(() => callOpenAI(chartType, data, context));
  } catch (error) {
    console.error('OpenAI API Error:', error);
    // Fallback to enhanced conditional insights if OpenAI fails
    console.log('Falling back to conditional insights...');
    
    try {
      switch (chartType) {
        case 'capacity':
          return generateCapacityInsight(data, context);
        case 'topRevenueEvents':
          return generateTopRevenueEventsInsight(data, context);
        case 'revenue':
          return generateRevenueInsight(data, context);
        case 'rsvpGrowth':
          return generateRSVPGrowthInsight(data, context);
        case 'revenueTimeline':
          return generateRevenueTimelineInsight(data, context);
        case 'sellOut':
          return generateSellOutInsight(data, context);
        case 'repeatGuest':
          return generateRepeatGuestInsight(data, context);
        case 'peakTiming':
          return generatePeakTimingInsight(data, context);
        case 'refund':
          return generateRefundInsight(data, context);
        case 'sellOutSpeed':
          return generateSellOutSpeedInsight(data, context);
        case 'community':
          return generateCommunityInsight(data, context);
        case 'satisfaction':
          return generateSatisfactionInsight(data, context);
        case 'monetization':
          return generateMonetizationInsight(data, context);
        case 'venueSize':
          return generateVenueSizeInsight(data, context);
        case 'newHost':
          return generateNewHostInsight(data, context);
      default:
        return generateGenericInsight(data, context);
      }
    } catch (fallbackError) {
      console.error('Fallback insights error:', fallbackError);
      return {
        message: "Unable to generate insights at this time.",
        recommendation: "Please try again later.",
        confidence: 0,
        icon: 'alert-circle',
        color: '#6b7280'
      };
    }
  }
};

// Cached wrapper to avoid spamming API
async function getInsightCached(chartType, data, context = {}) {
  const minimal = {
    t: chartType,
    d: (data?.data || []).map(({ label, value }) => [label, value]),
    extras: { title: data?.title, r: data?.refundRate, p: context?.timePeriod || 'current', h: context?.hostId || null },
  };
  const key = `ai:insight:${chartType}:${stableHash(minimal)}`;

  const mem = MemCache.get(key);
  if (mem && Date.now() - mem.at < MEM_TTL_MS) return mem.result;

  if (InFlight.has(key)) return InFlight.get(key);

  const p = (async () => {
    try {
      const res = await generateAIInsight(chartType, data, context);
      MemCache.set(key, { at: Date.now(), result: res });
      return res;
    } finally {
      InFlight.delete(key);
    }
  })();
  InFlight.set(key, p);
  return p;
}

/**
 * Capacity Fill Rate Insights
 */
const generateCapacityInsight = (data, context) => {
  const { avg } = data;
  const avgPercent = (avg * 100).toFixed(0);
  
  let message, recommendation, icon, color;
  
  if (avg > 0.8) {
    message = `Your VybeLocal RSVPs fill ${avgPercent}% of capacity on average - strong performance on the platform!`;
    recommendation = 'Great VybeLocal engagement! Consider featuring more events on the platform or adjusting capacity sizing.';
    icon = 'checkmark-circle';
    color = '#10b981';
  } else if (avg > 0.6) {
    message = `Your VybeLocal RSVPs average ${avgPercent}% of capacity - solid platform engagement.`;
    recommendation = 'Try promoting events earlier on VybeLocal or creating more compelling event descriptions.';
    icon = 'bulb';
    color = '#f59e0b';
  } else if (avg > 0.3) {
    message = `VybeLocal RSVPs average ${avgPercent}% of capacity - there's room to grow your audience here.`;
    recommendation = 'Focus on building your VybeLocal following through consistent posting and community engagement.';
    icon = 'trending-up';
    color = '#3b82f6';
  } else {
    message = `VybeLocal RSVPs average ${avgPercent}% of capacity - focus on building your platform presence.`;
    recommendation = 'Start with smaller capacity events to build momentum and grow your VybeLocal audience organically.';
    icon = 'trending-up';
    color = '#3b82f6';
  }
  
  return { message, recommendation, icon, color, confidence: 0.8 };
};

/**
 * Top Revenue Events (table) Insight
 */
const generateTopRevenueEventsInsight = (data, context) => {
  const rows = Array.isArray(data?.data) ? data.data : [];
  const top = rows.slice(0, 3);
  const best = top[0];
  const take = (best && Number(best.value) > 0)
    ? `Top pull: ${best.label} at $${Number(best.value).toFixed(0)}.`
    : 'No paid revenue in this window yet.';

  const message = rows.length
    ? `Your best earners — straight up. Copy what worked and scale.`
    : 'No top earners yet. Once paid events land, this fills up.';

  const recommendation = rows.length
    ? `${take} Test price bumps on high‑demand nights. Keep the vibe and promo timing the same, don’t mess with what converts.`
    : 'Run a priced event and push RSVPs 7–10 days out. Keep it simple, clear, and local.';

  return { message, recommendation, icon: 'cash', color: '#f59e0b', confidence: 0.8 };
};

/**
 * Revenue Insights (Top Earning Events)
 */
const generateRevenueInsight = (data, context) => {
  const totalRevenue = Number(data?.totalRevenue || 0);
  const rows = Array.isArray(data?.data) ? data.data : [];
  const top = rows.slice().sort((a,b)=>Number(b.value||0)-Number(a.value||0)).slice(0,3);
  const best = top[0];

  let message, recommendation, icon = 'trending-up', color = '#10b981';

  if (best && Number(best.value) > 0) {
    const bestAmt = Number(best.value).toFixed(0);
    const second = top[1] ? Number(top[1].value) : 0;
    const spread = second > 0 ? (Number(best.value)/second) : null;
    const dominance = spread && spread >= 1.5;

    message = dominance
      ? `${best.label} is your anchor — $${bestAmt} leads by a lot.`
      : `Revenue is spread. ${best.label} still on top at $${bestAmt}.`;

    recommendation = dominance
      ? 'Run that format again next month. Bump price 10–15% and keep timing/vibe identical.'
      : 'Pick the top 2 formats. Re-run both. Test pricing and push promo 7–10 days out.';
    color = dominance ? '#f59e0b' : '#10b981';
  } else if (totalRevenue > 0) {
    message = `Revenue moving: $${totalRevenue.toFixed(0)} so far.`;
    recommendation = 'Focus on one clean paid format. Keep price simple. Promote early.';
    color = '#3b82f6';
    icon = 'cash';
  } else {
    message = 'No paid revenue yet in this window.';
    recommendation = 'Run a priced event. Start with a fair floor. Promote consistently for a week.';
    color = '#3b82f6';
    icon = 'cash';
  }

  return { message, recommendation, icon, color, confidence: 0.85 };
};

/**
 * RSVP Growth Insights
 */
const generateRSVPGrowthInsight = (data, context) => {
  const { totalRsvps } = data;
  
  let message, recommendation, icon, color;
  
  if (totalRsvps > 100) {
    message = `You've built a strong VybeLocal community with ${totalRsvps} total RSVPs!`;
    recommendation = 'Keep the momentum going! Consider hosting premium events or expanding to new event types.';
    icon = 'trending-up';
    color = '#10b981';
  } else if (totalRsvps > 50) {
    message = `You're growing your VybeLocal presence with ${totalRsvps} RSVPs so far.`;
    recommendation = 'Post consistently and engage with your RSVPs to build a loyal community on the platform.';
    icon = 'bulb';
    color = '#f59e0b';
  } else if (totalRsvps > 10) {
    message = `You're getting started on VybeLocal with ${totalRsvps} RSVPs - good momentum!`;
    recommendation = 'Focus on creating compelling event descriptions and posting regularly to accelerate growth.';
    icon = 'rocket';
    color = '#3b82f6';
  } else {
    message = `You're just beginning your VybeLocal journey with ${totalRsvps} RSVPs.`;
    recommendation = 'Host 2-3 more events to establish your presence and start building a VybeLocal following.';
    icon = 'rocket';
    color = '#3b82f6';
  }
  
  return { message, recommendation, icon, color, confidence: 0.8 };
};

/**
 * Revenue Timeline Insights
 */
const generateRevenueTimelineInsight = (data, context) => {
  const points = Array.isArray(data?.data) ? data.data : [];
  const n = points.length;
  const values = points.map(p => Number(p.value || 0));
  const sum = values.reduce((a,b)=>a+b,0);
  const avg = n ? sum / n : 0;
  const last = values[n-1] || 0;
  let rising = 0; for (let i=1;i<n;i++){ if (values[i] > values[i-1]) rising++; }
  const trendUp = rising >= Math.floor(n/2);

  const message = trendUp
    ? `Net revenue is climbing. Last point: $${last.toFixed(0)}.`
    : `Net revenue is flat/down. Avg per point: $${avg.toFixed(0)}.`;

  const recommendation = trendUp
    ? 'Press what works: repeat the strongest format next window and test a 10–15% price bump.'
    : 'Tighten the format: smaller capacity, sharpen the pitch, and front‑load promo 7–10 days out.';

  return { message, recommendation, icon: trendUp ? 'trending-up' : 'trending-down', color: trendUp ? '#10b981' : '#f59e0b', confidence: 0.85 };
};

/**
 * Sell-Out Status Insights
 */
const generateSellOutInsight = (data, context) => {
  const soldOut = data.data.find(d => d.label === 'Sold Out')?.value || 0;
  const available = data.data.find(d => d.label === 'Available')?.value || 0;
  const noLimit = data.data.find(d => d.label === 'No Limit')?.value || 0;
  const total = soldOut + available + noLimit;
  
  let message, recommendation, icon, color;
  
  if (total === 0) {
    message = "No events to analyze yet.";
    recommendation = "Host your first event to start building data insights.";
    icon = 'calendar';
    color = '#3b82f6';
  } else if (soldOut / total > 0.5) {
    message = `${soldOut} of ${total} events sold out - excellent demand!`;
    recommendation = 'Consider increasing capacity or pricing for future events to maximize revenue.';
    icon = 'trending-up';
    color = '#10b981';
  } else if (soldOut > 0) {
    message = `${soldOut} events sold out with ${available} still taking RSVPs.`;
    recommendation = 'Great performance! Consider promoting earlier or adjusting capacity based on demand patterns.';
    icon = 'checkmark-circle';
    color = '#f59e0b';
  } else if (noLimit > available) {
    message = `Most events have no capacity limit - you're keeping it flexible.`;
    recommendation = 'Consider setting capacity limits to create urgency and better gauge demand.';
    icon = 'infinite';
    color = '#3b82f6';
  } else {
    message = `${available} events still have availability.`;
    recommendation = 'Focus on promotion and compelling event descriptions to boost RSVPs.';
    icon = 'megaphone';
    color = '#3b82f6';
  }
  
  return { message, recommendation, icon, color, confidence: 0.8 };
};

/**
 * Repeat Guest Insights
 */
const generateRepeatGuestInsight = (data, context) => {
  const oneEvent = data.data.find(d => d.label === '1 Event')?.value || 0;
  const multiEvent = data.data.filter(d => d.label !== '1 Event').reduce((sum, d) => sum + d.value, 0);
  const total = oneEvent + multiEvent;
  
  let message, recommendation, icon, color;
  
  if (total === 0) {
    message = "No guest data available yet.";
    recommendation = "Host more events to build your community and track repeat attendance.";
    icon = 'people';
    color = '#3b82f6';
  } else if (multiEvent / total > 0.4) {
    message = `${((multiEvent/total)*100).toFixed(0)}% of your guests are repeat attendees - you're building a community!`;
    recommendation = 'Consider launching a loyalty program or member perks to reward your regulars.';
    icon = 'heart';
    color = '#10b981';
  } else if (multiEvent / total > 0.2) {
    message = `${((multiEvent/total)*100).toFixed(0)}% of guests return for multiple events - solid engagement.`;
    recommendation = 'Focus on post-event follow-up and exclusive invites to increase repeat attendance.';
    icon = 'refresh';
    color = '#f59e0b';
  } else {
    message = `Most guests attend only one event - opportunity to build loyalty.`;
    recommendation = 'Create consistent event themes or series to encourage repeat attendance.';
    icon = 'magnet';
    color = '#3b82f6';
  }
  
  return { message, recommendation, icon, color, confidence: 0.8 };
};

/**
 * Peak Timing Insights
 */
const generatePeakTimingInsight = (data, context) => {
  const timingData = data.data;
  const total = timingData.reduce((sum, d) => sum + d.value, 0);
  
  if (total === 0) {
    return {
      message: "No RSVP timing data available yet.",
      recommendation: "Host more events to understand when people typically book.",
      icon: 'time',
      color: '#3b82f6',
      confidence: 0.5
    };
  }
  
  const maxCategory = timingData.reduce((max, current) => 
    current.value > max.value ? current : max
  );
  
  let message, recommendation, icon, color;
  
  if (maxCategory.label === 'Same Day') {
    message = `Most RSVPs happen same-day - people book last-minute!`;
    recommendation = 'Consider day-of promotions and ensure easy booking process for spontaneous attendees.';
    icon = 'flash';
    color = '#f59e0b';
  } else if (maxCategory.label === '1 Day Before') {
    message = `Peak booking window is 1 day before events.`;
    recommendation = 'Send reminder notifications 1-2 days before to capture peak interest.';
    icon = 'notifications';
    color = '#3b82f6';
  } else if (maxCategory.label.includes('Week')) {
    message = `Most people plan ahead and book 1+ weeks early.`;
    recommendation = 'Post events 2-3 weeks in advance to capture early planners.';
    icon = 'calendar';
    color = '#10b981';
  } else {
    message = `RSVPs are spread across different timeframes.`;
    recommendation = 'Use multiple promotion waves: early bird, reminder, and last-minute campaigns.';
    icon = 'trending-up';
    color = '#3b82f6';
  }
  
  return { message, recommendation, icon, color, confidence: 0.8 };
};

/**
 * Refund Rate Insights
 */
const generateRefundInsight = (data, context) => {
  // This would need refund data structure - placeholder for now
  const refundRate = data.refundRate || 0; // Assume this comes from data
  
  let message, recommendation, icon, color;
  
  if (refundRate < 0.05) {
    message = `Low refund rate (${(refundRate*100).toFixed(1)}%) - great event satisfaction!`;
    recommendation = 'Keep up the excellent event quality and clear communication.';
    icon = 'checkmark-circle';
    color = '#10b981';
  } else if (refundRate < 0.15) {
    message = `Moderate refund rate (${(refundRate*100).toFixed(1)}%) - room for improvement.`;
    recommendation = 'Review event descriptions for clarity and consider post-booking confirmation emails.';
    icon = 'information-circle';
    color = '#f59e0b';
  } else {
    message = `Higher refund rate (${(refundRate*100).toFixed(1)}%) detected.`;
    recommendation = 'Review event planning, communication, and set clearer expectations upfront.';
    icon = 'warning';
    color = '#ef4444';
  }
  
  return { message, recommendation, icon, color, confidence: 0.7 };
};

/**
 * Generic fallback insight
 */
const generateGenericInsight = (data, context) => {
  return {
    message: "Analytics data processed successfully.",
    recommendation: "Continue hosting events to build more detailed insights.",
    icon: 'analytics',
    color: '#3b82f6',
    confidence: 0.5
  };
};

/**
 * Real OpenAI Integration with VybeLocal Voice
 */
const callOpenAI = async (chartType, data, context) => {
  // Get OpenAI API key from environment variables
  const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const USE_OPENAI = (process.env.EXPO_PUBLIC_USE_OPENAI ?? 'true') !== 'false';
  
  if (!OPENAI_API_KEY || !USE_OPENAI) {
    throw new Error('OpenAI disabled or key missing');
  }

  const payload = buildFeatureSummary(chartType, data, context);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are VybeLocal's analytics voice.

TONE
- Grounded, not gimmicky. No forced slang.
- Confident, not performative. Plain, direct, city‑smart.
- Alive, not corporate. Real pulse, no cheerleader fluff.

CORE STYLE FILTERS
- Weight over fluff: street‑poster energy, not ad campaign.
- Edge + clarity: a little rebellious, never cartoonish.
- Everyday speech: how locals talk at a bar, run, or gym.

ANTI‑CAMP RULES
- Never use filler hype words (no “fam,” “lit,” “squad goals”).
- No exaggerated punctuation unless it truly fits.
- No faux slang you wouldn’t say in El Paso.

LITMUS TEST
- Could I say this at a coffee shop without sounding like a clown? If yes → keep. If no → delete.

STYLE
- Short lines (< 16 words). Verbs first. Use contractions.
- Occasional desert cues (horizon, heat, night, flow) only when natural.
- Micro‑rituals: Vybe, Circle, unlocked, in, local, start here.
- Principles: Simplicity. Action over explanation. Transparency.

OUTPUT
Return STRICT JSON with keys: message, recommendation, confidence. Use provided KPIs/highlights and units to deliver 1–2 sharp, valuable takeaways that drive action. When chartType is 'capacity', use avgPct and soldOutPct; never echo raw ratios like 0.38. Format percents like "42.0%". Keep sentences tight and human.`
        },
        { role: "user", content: JSON.stringify(payload) }
      ],
      response_format: { type: "json_object" },
      max_tokens: 160,
      temperature: 0.6
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const result = await response.json();
  const aiResponse = JSON.parse(result.choices[0].message.content);
  
  return {
    message: aiResponse.message,
    recommendation: aiResponse.recommendation,
    confidence: aiResponse.confidence || 0.8,
    icon: determineIcon(chartType, data),
    color: determineColor(chartType, data)
  };
};

/**
 * Build a compact but information-dense feature summary for the model
 */
const buildFeatureSummary = (chartType, data, context) => {
  const round = (n, d = 2) => Number((n || 0).toFixed(d));
  let series = Array.isArray(data?.data) ? data.data : [];
  // Deduplicate identical consecutive labels/values to avoid weird reads
  series = series.filter((pt, idx, arr) => idx === 0 || !(pt.label === arr[idx-1].label && Number(pt.value||0) === Number(arr[idx-1].value||0)));

  const summarizeSeries = (points) => {
    if (!points.length) return { n: 0 };
    const values = points.map(p => Number(p.value || 0));
    const n = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / n;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const first = values[0];
    const last = values[n - 1];
    const delta = last - first;
    const pct = first > 0 ? (delta / Math.abs(first)) : null;
    const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / n;
    const std = Math.sqrt(variance);
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sx += i; sy += values[i]; sxy += i * values[i]; sxx += i * i; }
    const denom = (n * sxx - sx * sx) || 1;
    const slope = (n * sxy - sx * sy) / denom;
    const top = points
      .map(p => ({ l: p.label, v: Number(p.value || 0) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3);
    const firstLabel = points[0]?.label || null;
    const lastLabel = points[n - 1]?.label || null;
    return { n, first: round(first), last: round(last), delta: round(delta), pct: pct == null ? null : round(pct, 3), min: round(min), max: round(max), avg: round(avg), std: round(std), slope: round(slope, 3), top, firstLabel, lastLabel };
  };

  const payload = { t: chartType, p: context?.timePeriod || 'current', hostId: context?.hostId || null };

  switch (chartType) {
    case 'capacity': {
      // Expect series as bucket counts: labels ["0-25%","26-50%","51-75%","76-99%","100%","No Capacity"]
      const bucketMap = Object.fromEntries((series || []).map(d => [d.label, Number(d.value || 0)]));
      const nWithCap = ['0-25%','26-50%','51-75%','76-99%','100%'].reduce((s,k)=> s + (bucketMap[k]||0), 0);
      const noCap = bucketMap['No Capacity'] || 0;
      const soldOut = bucketMap['100%'] || 0;
      const nearFull = bucketMap['76-99%'] || 0;
      const underHalf = (bucketMap['0-25%']||0) + (bucketMap['26-50%']||0);
      const avgRatio = round(data?.avg ?? 0, 3);
      const avgPct = round(avgRatio * 100, 1);
      const soldOutPct = nWithCap > 0 ? round((soldOut / nWithCap) * 100, 1) : 0;
      payload.kpis = { avgRatio, avgPct, nWithCap, noCap, soldOut, soldOutPct, nearFull, underHalf };
      payload.highlights = { dist: bucketMap };
      payload.units = { avgRatio: 'ratio', avgPct: 'percent' };
      payload.window = { start: data?.window?.start || null, end: data?.window?.end || null };
      payload.guide = 'Fill rate = RSVPs ÷ capacity per event. avgPct is the mean fill percent across events in this window. Buckets count events by fill. 100% = sold out. “No Capacity” should not affect avg. Use percents in copy (e.g., 42.0%), never raw decimals (0.42). Actions: high 76–99%/100% → raise capacity/price; many 0–50% → smaller venues/promo; lots of No Capacity → set capacity.';
      break;
    }
    case 'revenue': {
      payload.kpis = { tr: round(data?.totalRevenue ?? 0, 2) };
      payload.highlights = { top: series.sort((a,b)=>b.value-a.value).slice(0,3).map(d=>({ l:d.label, v: round(d.value,2) })) };
      break;
    }
    case 'rsvpGrowth': {
      const s = summarizeSeries(series);
      // Distinguish lifetime vs period totals to avoid confusion
      payload.kpis = {
        lifetimeTotal: typeof data?.totalRsvps === 'number' ? data.totalRsvps : null,
        periodStart: s.first,
        periodEnd: s.last,
        periodTotal: s.last,
        periodDelta: s.delta,
        growthPct: s.pct, // null when starting from zero
        growthFromZero: s.first === 0 && s.last > 0,
        slope: s.slope
      };
      payload.window = { start: s.firstLabel, end: s.lastLabel };
      payload.highlights = { top: s.top };
      break;
    }
    case 'revenueTimeline': {
      const s = summarizeSeries(series);
      payload.kpis = { periodTotal: round(s.last, 2), delta: s.delta, pct: s.pct, slope: s.slope, mh: (data?.achievedMilestones || []).length, nm: data?.nextMilestone ?? null };
      payload.window = { start: s.firstLabel, end: s.lastLabel };
      payload.highlights = { top: s.top };
      break;
    }
    case 'sellOut': {
      const map = Object.fromEntries(series.map(d => [d.label, Number(d.value || 0)]));
      const total = (map['Sold Out'] || 0) + (map['Available'] || 0) + (map['No Limit'] || 0);
      const rate = total ? (map['Sold Out'] || 0) / total : 0;
      payload.kpis = { total, soldOut: map['Sold Out'] || 0, rate: round(rate, 3) };
      break;
    }
    case 'repeatGuest': {
      const one = series.find(d => d.label === '1 Event')?.value || 0;
      const multi = series.filter(d => d.label !== '1 Event').reduce((s, d) => s + (d.value || 0), 0);
      const total = one + multi;
      payload.kpis = { total, repeatRate: total ? round(multi / total, 3) : 0 };
      break;
    }
    case 'peakTiming': {
      const top = series.slice().sort((a,b)=>b.value-a.value).slice(0,2).map(d=>({ l:d.label, v:d.value }));
      payload.kpis = { dominant: top[0]?.l || null };
      payload.highlights = { top };
      break;
    }
    case 'refund': {
      payload.kpis = { rr: round(data?.refundRate ?? 0, 3) };
      break;
    }
    case 'sellOutSpeed': {
      payload.kpis = { avgHrs: round(data?.avgSellOutSpeed ?? 0, 2) };
      break;
    }
    case 'community': {
      payload.kpis = { repeatGuestRate: round(data?.repeatGuestRate ?? 0, 3) };
      break;
    }
    case 'satisfaction': {
      payload.kpis = { rr: round(data?.refundRate ?? 0, 3) };
      break;
    }
    case 'monetization': {
      payload.kpis = { rpa: round(data?.revenuePerAttendee ?? 0, 2) };
      break;
    }
    case 'venueSize': {
      payload.kpis = { cfr: round(data?.capacityFillRate ?? 0, 3) };
      break;
    }
    case 'newHost': {
      payload.kpis = { te: data?.totalEvents ?? 0, trv: data?.totalRsvps ?? 0 };
      break;
    }
    default: {
      payload.kpis = { hasData: !!series.length };
    }
  }

  // Optional extras that are cheap but useful
  const extras = {};
  if (typeof data?.avgTicketPrice === 'number') extras.atp = round(data.avgTicketPrice, 2);
  if (typeof data?.capacityFillRate === 'number') extras.cfr = round(data.capacityFillRate, 3);
  if (typeof data?.afterTaxRevenue === 'number') extras.atr = round(data.afterTaxRevenue, 2);
  if (Object.keys(extras).length) payload.extras = extras;

  // Units help the model interpret KPIs correctly
  const units = {
    capacity: { avg: 'ratio' },
    revenue: { tr: 'usd' },
    rsvpGrowth: { periodTotal: 'count', lifetimeTotal: 'count' },
    revenueTimeline: { periodTotal: 'usd' },
    sellOut: { rate: 'ratio' },
    repeatGuest: { repeatRate: 'ratio' },
    refund: { rr: 'ratio' },
    sellOutSpeed: { avgHrs: 'hours' },
    community: { repeatGuestRate: 'ratio' },
    satisfaction: { rr: 'ratio' },
    monetization: { rpa: 'usd' },
    venueSize: { cfr: 'ratio' }
  };
  if (units[chartType]) payload.units = units[chartType];

  return payload;
};

/**
 * Determine appropriate icon based on chart type and performance
 */
const determineIcon = (chartType, data) => {
  switch (chartType) {
    case 'capacity':
      return data.avg > 0.7 ? 'checkmark-circle' : data.avg > 0.4 ? 'trending-up' : 'bulb';
    case 'revenue':
    case 'revenueTimeline':
      const revenue = data.totalRevenue || 0;
      return revenue > 5000 ? 'trophy' : revenue > 1000 ? 'trending-up' : 'cash';
    case 'rsvpGrowth':
      const rsvps = data.totalRsvps || 0;
      return rsvps > 100 ? 'trending-up' : rsvps > 50 ? 'rocket' : 'people';
    case 'sellOut':
      return 'stats-chart';
    case 'repeatGuest':
      return 'heart';
    case 'peakTiming':
      return 'time';
    case 'refund':
      return 'shield-checkmark';
    default:
      return 'analytics';
  }
};

/**
 * Determine appropriate color based on performance
 */
const determineColor = (chartType, data) => {
  switch (chartType) {
    case 'capacity':
      return data.avg > 0.7 ? '#10b981' : data.avg > 0.4 ? '#f59e0b' : '#3b82f6';
    case 'revenue':
    case 'revenueTimeline':
      const revenue = data.totalRevenue || 0;
      return revenue > 5000 ? '#10b981' : revenue > 1000 ? '#f59e0b' : '#3b82f6';
    case 'rsvpGrowth':
      const rsvps = data.totalRsvps || 0;
      return rsvps > 100 ? '#10b981' : rsvps > 50 ? '#f59e0b' : '#3b82f6';
    default:
      return '#3b82f6';
  }
};

/**
 * Analytics Drawer Specific Insights
 */

const generateSellOutSpeedInsight = (data, context) => {
  const { avgSellOutSpeed } = data;
  
  let message, recommendation, icon, color;
  
  if (avgSellOutSpeed < 24) {
    message = `Your events sell out in ${avgSellOutSpeed.toFixed(1)} hours on average - that's killer demand!`;
    recommendation = 'Consider raising prices or booking bigger venues to capture more revenue from this hot demand.';
    icon = 'trending-up';
    color = '#10b981';
  } else if (avgSellOutSpeed < 168) {
    message = `Events sell out in ${(avgSellOutSpeed/24).toFixed(1)} days - solid interest building up.`;
    recommendation = 'Try early bird pricing or limited-time promos to accelerate that booking momentum.';
    icon = 'time';
    color = '#f59e0b';
  } else {
    message = `Takes ${(avgSellOutSpeed/24).toFixed(1)} days to sell out - room to build more buzz.`;
    recommendation = 'Focus on earlier promotion and creating more urgency around your events.';
    icon = 'megaphone';
    color = '#3b82f6';
  }
  
  return { message, recommendation, icon, color, confidence: 0.8 };
};

const generateCommunityInsight = (data, context) => {
  const { repeatGuestRate } = data;
  const repeatPercent = (repeatGuestRate * 100).toFixed(1);
  
  let message, recommendation, icon, color;
  
  if (repeatGuestRate > 0.3) {
    message = `${repeatPercent}% repeat guests - you're building a real community here!`;
    recommendation = 'Consider launching a loyalty program or VIP perks to reward your regulars.';
    icon = 'heart';
    color = '#10b981';
  } else if (repeatGuestRate > 0.15) {
    message = `${repeatPercent}% come back for more - decent loyalty building.`;
    recommendation = 'Focus on post-event follow-up and exclusive invites to boost repeat attendance.';
    icon = 'people';
    color = '#f59e0b';
  } else {
    message = `Only ${repeatPercent}% repeat guests - mostly new faces each time.`;
    recommendation = 'Work on creating consistent experiences and follow-up to build deeper connections.';
    icon = 'person-add';
    color = '#3b82f6';
  }
  
  return { message, recommendation, icon, color, confidence: 0.8 };
};

const generateSatisfactionInsight = (data, context) => {
  const { refundRate } = data;
  const refundPercent = (refundRate * 100).toFixed(1);
  
  let message, recommendation, icon, color;
  
  if (refundRate < 0.05) {
    message = `${refundPercent}% refund rate - people love what you're doing!`;
    recommendation = 'Keep that quality consistent and maybe document what\'s working so well.';
    icon = 'checkmark-circle';
    color = '#10b981';
  } else if (refundRate < 0.15) {
    message = `${refundPercent}% refunds - not bad, but there's room to improve satisfaction.`;
    recommendation = 'Check your event descriptions for clarity and maybe tighten the refund window.';
    icon = 'information-circle';
    color = '#f59e0b';
  } else {
    message = `${refundPercent}% refund rate is pretty high - something might be off.`;
    recommendation = 'Review your event planning and communication to set better expectations upfront.';
    icon = 'warning';
    color = '#ef4444';
  }
  
  return { message, recommendation, icon, color, confidence: 0.8 };
};

const generateMonetizationInsight = (data, context) => {
  const { revenuePerAttendee } = data;
  
  let message, recommendation, icon, color;
  
  if (revenuePerAttendee > 25) {
    message = `$${revenuePerAttendee.toFixed(2)} per person - you're monetizing well!`;
    recommendation = 'Consider premium tiers or add-ons to push that number even higher.';
    icon = 'trophy';
    color = '#10b981';
  } else if (revenuePerAttendee > 10) {
    message = `$${revenuePerAttendee.toFixed(2)} per attendee - decent revenue but room to grow.`;
    recommendation = 'Try bundling experiences or offering upgrades to boost per-person value.';
    icon = 'trending-up';
    color = '#f59e0b';
  } else {
    message = `$${revenuePerAttendee.toFixed(2)} per person - definitely leaving money on the table.`;
    recommendation = 'Consider raising prices, adding premium options, or selling merchandise.';
    icon = 'cash';
    color = '#3b82f6';
  }
  
  return { message, recommendation, icon, color, confidence: 0.8 };
};

const generateVenueSizeInsight = (data, context) => {
  const { capacityFillRate } = data;
  const fillPercent = (capacityFillRate * 100).toFixed(1);
  
  let message, recommendation, icon, color;
  
  if (capacityFillRate > 0.8) {
    message = `${fillPercent}% capacity fill rate - you're packing them in!`;
    recommendation = 'Consider bigger venues or multiple dates to accommodate demand.';
    icon = 'people';
    color = '#10b981';
  } else if (capacityFillRate > 0.5) {
    message = `${fillPercent}% filled - solid turnout but room for more.`;
    recommendation = 'Focus on promotion or try slightly smaller venues for better atmosphere.';
    icon = 'resize';
    color = '#f59e0b';
  } else {
    message = `${fillPercent}% capacity - venues might be too big for your current draw.`;
    recommendation = 'Try smaller, more intimate spaces to create better vibes and reduce costs.';
    icon = 'contract';
    color = '#3b82f6';
  }
  
  return { message, recommendation, icon, color, confidence: 0.8 };
};

const generateNewHostInsight = (data, context) => {
  const { totalEvents, totalRsvps } = data;
  
  let message, recommendation, icon, color;
  
  if (totalEvents === 0) {
    message = "Ready to host your first VybeLocal event?";
    recommendation = 'Start with something you\'re passionate about - authenticity draws the right crowd.';
    icon = 'rocket';
    color = '#3b82f6';
  } else if (totalEvents < 3) {
    message = `${totalEvents} event${totalEvents > 1 ? 's' : ''} down - you're just getting started!`;
    recommendation = 'Host 2-3 more to unlock deeper insights and start building your community.';
    icon = 'trending-up';
    color = '#f59e0b';
  } else {
    message = `${totalEvents} events and ${totalRsvps} total RSVPs - momentum building!`;
    recommendation = 'Keep that consistency going and start experimenting with different event types.';
    icon = 'checkmark-circle';
    color = '#10b981';
  }
  
  return { message, recommendation, icon, color, confidence: 0.8 };
};

// Export for React Native
module.exports = {
  generateAIInsight,
  getInsightCached
};