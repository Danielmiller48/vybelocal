// utils/sendHostEmail.js
import { sendEmail } from './email.js';

export async function sendHostEmail(to, eventTitle, status) {
  const subject = status === 'approved'
    ? `Your event "${eventTitle}" is live!`
    : `Your event "${eventTitle}" needs tweaks`;

  const text = status === 'approved'
    ? `Great news — your event "${eventTitle}" has been approved and is now visible on VybeLocal.`
    : `Your event "${eventTitle}" was not approved this time. Please review the guidelines and edit your submission.`;

  await sendEmail({ to, subject, text });
}
