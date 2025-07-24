// utils/ai/cancelEval.js

export async function evaluateCancellation({ reason, eventInfo, hostHistory }) {
  const sys = `You are a cancellation review assistant for VybeLocal, a community event platform.\nYour job is to evaluate same-day event cancellation reasons submitted by hosts.\nDecide whether the cancellation is involuntary (valid: weather, emergencies) or voluntary (avoidable).\nReturn structured JSON in this exact schema:\n{\n  \"strike_recommendation\": \"yes\" | \"no\" | \"flag\",\n  \"cancellation_type\": \"involuntary\" | \"voluntary\",\n  \"confidence_score\": float,\n  \"moderator_note\": string\n}`;

  const examples = [
    { role:'user', content:`Reason: "Storm rolled in and soaked the field. We were setting up but had to bail—totally unsafe."\nEvent: Outdoors in El Paso, July 20, 6PM\nWeather: Confirmed rain 5:00–7:30 PM\nHost history: 0 cancellations in 90 days` },
    { role:'assistant', content:`{\n  \"strike_recommendation\": \"no\",\n  \"cancellation_type\": \"involuntary\",\n  \"confidence_score\": 0.96,\n  \"moderator_note\": \"Weather confirmed and tone is credible. First cancellation. No strike applied.\"\n}` },
    { role:'user', content:`Reason: "Only 2 RSVPs, figured it wasn’t worth it. Maybe next week."\nEvent: Indoor\nWeather: Clear\nHost history: 1 cancellation in past 45 days` },
    { role:'assistant', content:`{\n  \"strike_recommendation\": \"yes\",\n  \"cancellation_type\": \"voluntary\",\n  \"confidence_score\": 0.88,\n  \"moderator_note\": \"Avoidable cancellation due to low attendance. Pattern forming. Strike applied.\"\n}` },
    { role:'user', content:`Reason: "Family emergency—my child was taken to urgent care."\nEvent: Indoor studio\nWeather: Clear\nHost history: 0 cancellations in past year` },
    { role:'assistant', content:`{\n  \"strike_recommendation\": \"no\",\n  \"cancellation_type\": \"involuntary\",\n  \"confidence_score\": 0.92,\n  \"moderator_note\": \"Medical emergency is valid. First cancellation.\"\n}` },
    { role:'user', content:`Reason: "Forgot I have other plans"\nEvent: Outdoor park\nWeather: Sunny\nHost history: 2 cancellations in past 30 days` },
    { role:'assistant', content:`{\n  \"strike_recommendation\": \"yes\",\n  \"cancellation_type\": \"voluntary\",\n  \"confidence_score\": 0.93,\n  \"moderator_note\": \"Clearly avoidable; repeat pattern. Strike applied.\"\n}` },
    { role:'user', content:`Reason: "Power outage at venue. Venue manager shut us down."\nEvent: Indoor\nWeather: Storm earlier in day\nHost history: 1 cancellation in 180 days` },
    { role:'assistant', content:`{\n  \"strike_recommendation\": \"no\",\n  \"cancellation_type\": \"involuntary\",\n  \"confidence_score\": 0.81,\n  \"moderator_note\": \"Reason outside host control (venue power).\"\n}` },
    { role:'user', content:`Reason: "Rain again. Can't do it."\nEvent: Indoor gym\nWeather: Clear\nHost history: 3 cancellations in past 45 days` },
    { role:'assistant', content:`{\n  \"strike_recommendation\": \"flag\",\n  \"cancellation_type\": \"voluntary\",\n  \"confidence_score\": 0.67,\n  \"moderator_note\": \"Excuse contradicts indoor venue; pattern of cancellations. Flag for deeper review.\"\n}` },
    { role:'user', content:`Reason: "Car broke down, waiting on tow—can't get to venue in time."\nEvent: Outdoor\nWeather: Clear\nHost history: 0 cancellations` },
    { role:'assistant', content:`{\n  \"strike_recommendation\": \"no\",\n  \"cancellation_type\": \"involuntary\",\n  \"confidence_score\": 0.75,\n  \"moderator_note\": \"Unexpected vehicle breakdown; plausible first-time issue.\"\n}` },
    { role:'user', content:`Reason: "Double-booked another paid gig, sorry."\nEvent: Indoor\nWeather: Clear\nHost history: 1 cancellation last month` },
    { role:'assistant', content:`{\n  \"strike_recommendation\": \"yes\",\n  \"cancellation_type\": \"voluntary\",\n  \"confidence_score\": 0.9,\n  \"moderator_note\": \"Host prioritized another commitment; avoidable. Strike.\"\n}` },
    { role:'user', content:`Reason: "Police shut down event due to permit issue."\nEvent: Outdoor street fair\nWeather: Clear\nHost history: 0 cancellations` },
    { role:'assistant', content:`{\n  \"strike_recommendation\": \"flag\",\n  \"cancellation_type\": \"voluntary\",\n  \"confidence_score\": 0.55,\n  \"moderator_note\": \"Permit oversight may be host fault but unclear; needs human review.\"\n}` }
  ];

  const userPrompt = `Event info: ${eventInfo}\nHost history: ${hostHistory} prior cancellations (last 6 mo)\nReason: "${reason}"`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role:'system', content: sys },
        ...examples,
        { role:'user', content: userPrompt }
      ],
      temperature: 0.2,
    }),
  });
  const json = await res.json();
  try {
    const text = json.choices[0].message.content.trim();
    const parsed = JSON.parse(text);
    return parsed;
  } catch {
    return { strike_recommendation: 'no', confidence_score: 0 };
  }
} 