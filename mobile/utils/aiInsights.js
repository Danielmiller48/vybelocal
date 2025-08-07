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
    extras: { title: data?.title, r: data?.refundRate, p: context?.timePeriod || 'current' },
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
 * Revenue Insights (Top Earning Events)
 */
const generateRevenueInsight = (data, context) => {
  const { totalRevenue } = data;
  
  let message, recommendation, icon, color;
  
  if (totalRevenue > 1000) {
    message = `You've earned $${totalRevenue.toFixed(0)} from VybeLocal RSVPs!`;
    recommendation = 'Consider premium event tiers or merchandise to further increase revenue.';
    icon = 'trending-up';
    color = '#10b981';
  } else if (totalRevenue > 200) {
    message = `You've made $${totalRevenue.toFixed(0)} on VybeLocal so far.`;
    recommendation = 'Keep experimenting with ticket pricing and promotion to boost earnings.';
    icon = 'bulb';
    color = '#f59e0b';
  } else if (totalRevenue > 0) {
    message = `You've started earning on VybeLocal with $${totalRevenue.toFixed(0)} in revenue.`;
    recommendation = 'Post more events and promote them to grow your VybeLocal revenue.';
    icon = 'cash';
    color = '#3b82f6';
  } else {
    message = `You haven't earned on VybeLocal yet.`;
    recommendation = 'Host your first paid event to start earning on VybeLocal.';
    icon = 'cash';
    color = '#3b82f6';
  }
  
  return { message, recommendation, icon, color, confidence: 0.8 };
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
  const { totalRevenue, achievedMilestones, nextMilestone } = data;
  
  let message, recommendation, icon, color;
  
  if (achievedMilestones && achievedMilestones.length > 0) {
    message = `You've reached ${achievedMilestones.length} milestone${achievedMilestones.length > 1 ? 's' : ''} with $${totalRevenue.toFixed(0)} in total revenue!`;
  } else if (totalRevenue > 100) {
    message = `You've generated $${totalRevenue.toFixed(0)} in revenue - building momentum!`;
  } else if (totalRevenue > 0) {
    message = `You've earned your first $${totalRevenue.toFixed(0)} on VybeLocal!`;
  } else {
    message = `Ready to start your revenue journey on VybeLocal.`;
  }
  
  if (nextMilestone) {
    recommendation = `Only $${(nextMilestone - totalRevenue).toFixed(0)} more to reach your next milestone!`;
  } else if (totalRevenue > 10000) {
    recommendation = 'You\'re in the top tier of VybeLocal hosts - consider mentoring others or hosting premium experiences.';
  } else if (totalRevenue > 1000) {
    recommendation = 'Great progress! Focus on consistent event hosting and premium pricing strategies.';
  } else if (totalRevenue > 100) {
    recommendation = 'Keep hosting regularly and experiment with different price points to accelerate growth.';
  } else {
    recommendation = 'Start with your first paid event to begin building revenue momentum.';
  }
  
  if (totalRevenue > 5000) {
    icon = 'trophy';
    color = '#10b981';
  } else if (totalRevenue > 1000) {
    icon = 'trending-up';
    color = '#f59e0b';
  } else {
    icon = 'cash';
    color = '#3b82f6';
  }
  
  return { message, recommendation, icon, color, confidence: 0.8 };
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

  const prompt = createVybeLocalPrompt(chartType, data, context);
  
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
          content: `You're an analytics assistant for VybeLocal, a community-driven event platform. 

VOICE & STYLE:
- Avoid corporate or overly polished language
- Use contractions: "you're" not "you are"  
- Friendly but not fake. Gritty but not rude
- Write like you're texting someone cool
- Rooted in real community
- Slightly defiant
- Warm, confident, and anti-cringe
- Human above all

Respond with JSON: {"message": "insight about their data", "recommendation": "actionable advice", "confidence": 0.8}`
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.7
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
 * Create VybeLocal-specific prompts for different chart types
 */
const createVybeLocalPrompt = (chartType, data, context) => {
  const baseContext = `User is a VybeLocal host analyzing their ${chartType} analytics.`;
  
  switch (chartType) {
    case 'capacity':
      return `${baseContext}
      
Their capacity fill rate data: ${JSON.stringify(data)}
Average fill rate: ${((data.avg || 0) * 100).toFixed(1)}%

Analyze their venue sizing and RSVP performance. Give them real talk about their capacity strategy - are they booking spaces too big? Too small? What should they do differently?`;

    case 'revenue':
      return `${baseContext}
      
Revenue data: ${JSON.stringify(data)}
Total revenue from top events: $${data.totalRevenue || 0}

Look at their earning potential. Are they leaving money on the table? Should they raise prices? Try premium events? Give them honest advice about monetizing their community.`;

    case 'rsvpGrowth':
      return `${baseContext}
      
RSVP growth data: ${JSON.stringify(data)}
Total RSVPs: ${data.totalRsvps || 0}

How's their community building going? Are they gaining momentum or stuck? What should they focus on to grow their VybeLocal presence?`;

    case 'revenueTimeline':
      return `${baseContext}
      
Revenue timeline: ${JSON.stringify(data)}
Total revenue: $${data.totalRevenue || 0}
Milestones hit: ${data.achievedMilestones?.length || 0}
Next milestone: $${data.nextMilestone || 'N/A'}

Analyze their revenue journey. Are they crushing it? Building steady momentum? What's their next move to hit that next milestone?`;

    case 'sellOut':
      return `${baseContext}
      
Sell-out status: ${JSON.stringify(data.data)}

Look at their event demand patterns. Are they consistently selling out? Having trouble filling spots? What does this tell them about their audience and pricing?`;

    case 'repeatGuest':
      return `${baseContext}
      
Repeat attendance: ${JSON.stringify(data.data)}

How loyal is their community? Are people coming back for more or just one-and-done? What can they do to build deeper connections?`;

    case 'peakTiming':
      return `${baseContext}
      
RSVP timing patterns: ${JSON.stringify(data.data)}

When do people actually book their events? Last minute? Way in advance? How should they adjust their promotion strategy?`;

    case 'refund':
      return `${baseContext}
      
Refund data: ${JSON.stringify(data)}

What's their refund situation telling them? Too many cancellations might mean unclear expectations or event quality issues.`;

    case 'sellOutSpeed':
      return `${baseContext}
      
Sell-out timing: ${JSON.stringify(data)}
Average time to sell out: ${data.avgSellOutSpeed} hours

How fast are they selling out? Is this showing killer demand or slow momentum? What should they do about it?`;

    case 'community':
      return `${baseContext}
      
Community loyalty: ${JSON.stringify(data)}
Repeat guest rate: ${(data.repeatGuestRate * 100).toFixed(1)}%

How loyal is their community? Are people coming back or just one-and-done? What can they do to build deeper connections?`;

    case 'satisfaction':
      return `${baseContext}
      
Satisfaction metrics: ${JSON.stringify(data)}
Refund rate: ${(data.refundRate * 100).toFixed(1)}%

What's their refund rate telling them about satisfaction? Any red flags or things they should address?`;

    case 'monetization':
      return `${baseContext}
      
Revenue metrics: ${JSON.stringify(data)}
Revenue per attendee: $${data.revenuePerAttendee}

Are they maximizing revenue per person? Leaving money on the table? What monetization strategies should they try?`;

    case 'venueSize':
      return `${baseContext}
      
Venue utilization: ${JSON.stringify(data)}
Capacity fill rate: ${(data.capacityFillRate * 100).toFixed(1)}%

Are they sizing their venues right? Too big? Too small? What should they adjust about their space strategy?`;

    case 'newHost':
      return `${baseContext}
      
New host data: ${JSON.stringify(data)}
Total events: ${data.totalEvents}, Total RSVPs: ${data.totalRsvps}

They're just getting started. What encouragement and next steps should they focus on to build momentum?`;

    default:
      return `${baseContext} Data: ${JSON.stringify(data)}. Give them insights about their event performance.`;
  }
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