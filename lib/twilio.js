// /lib/twilio.js
const { Twilio } = require('twilio');

const twilio = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.sendVerify = (phone) => {
  const channel = (process.env.TWILIO_VERIFY_CHANNEL || 'sms').toLowerCase();
  return twilio.verify.v2
    .services(process.env.TWILIO_VERIFY_SID)
    .verifications.create({ to: phone, channel: channel === 'call' ? 'call' : 'sms' });
};

exports.checkVerify = (phone, code) =>
  twilio.verify.v2.services(process.env.TWILIO_VERIFY_SID)
        .verificationChecks.create({ to: phone, code });
