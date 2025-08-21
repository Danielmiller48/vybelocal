// utils/sendHostEmail.js
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export async function sendHostEmail(to, eventTitle, status) {
  const subject = status === 'approved'
    ? `Your event "${eventTitle}" is live!`
    : `Your event "${eventTitle}" needs tweaks`

  const text = status === 'approved'
    ? `Great news — your event "${eventTitle}" has been approved and is now visible on VybeLocal.`
    : `Your event "${eventTitle}" was not approved this time. Please review the guidelines and edit your submission.`

  const msg = {
    to,
    from: process.env.SENDGRID_FROM,
    subject,
    text,
  }

  try {
    await sgMail.send(msg)
  } catch (err) {
    console.error('SendGrid error:', err.response?.body || err)
  }
}
