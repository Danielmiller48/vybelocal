// utils/email.js
// -----------------------------------------------------------------------------
// Lightweight helper to send emails via Resend REST API. Keeps dependencies
// minimal (no SDK) and works in serverless edge/runtime environments.
// -----------------------------------------------------------------------------

/**
 * sendEmail({ to, subject, text, html? })
 * --------------------------------------
 * Uses the Resend API to send a simple email.
 * - Requires env var RESEND_API_KEY.
 * - Uses RESEND_FROM or fallback address for From.
 *
 * @param {object} opts
 * @param {string|string[]} opts.to       – recipient email(s)
 * @param {string}        opts.subject  – email subject
 * @param {string}        opts.text     – plain-text body
 * @param {string} [opts.html]          – optional HTML body
 */
export async function sendEmail({ to, subject, text, html }) {
  const key   = process.env.RESEND_API_KEY;
  const from  = process.env.RESEND_FROM || 'support@vybelocal.com';
  if (!key) {
    console.error('Resend API key missing – set RESEND_API_KEY');
    return;
  }

  const payload = { from, to, subject, text };
  if (html) payload.html = html;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend error ${res.status}: ${errText}`);
    }
  } catch (err) {
    console.error('Resend email error:', err);
  }
}

/**
 * sendGuestCancelEmail
 * --------------------
 * Sends an email to a guest when an event is canceled.
 * Chooses template based on whether event was paid.
 */
export async function sendGuestCancelEmail({
  to,
  guestFirst,
  eventTitle,
  eventDateTime,
  hostName,
  wasPaid,
}) {
  const subject = `Update on "${eventTitle}"`;

  const lines = [
    `Hey ${guestFirst},`,
    '',
    `Unfortunately, the event you RSVP’d to was canceled:`,
    '',
    `📍 ${eventTitle}`,
    `🗓 ${eventDateTime}`,
    `🎟 Host: ${hostName}`,
    '',
  ];

  if (wasPaid) {
    lines.push('We’ve gone ahead and refunded your RSVP in full—no action needed on your end.', '');
  }

  lines.push(
    'At VybeLocal, we know showing up starts with trust. That’s why we take cancellations seriously and track every host’s reliability. Hosts who cancel too often lose access to our tools.',
    '',
    'Thanks for riding with us.',
    'We’re building something real, one Vybe at a time.',
    '',
    '— The VybeLocal Team',
    'support@vybelocal.com'
  );

  const text = lines.join('\n');
  await sendEmail({ to, subject, text });
} 