// /lib/twilio.js
const { Twilio } = require('twilio');

const twilio = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.sendVerify = (phone) =>
  twilio.verify.v2.services(process.env.TWILIO_VERIFY_SID)
        .verifications.create({ to: phone, channel: 'sms' });

exports.checkVerify = (phone, code) =>
  twilio.verify.v2.services(process.env.TWILIO_VERIFY_SID)
        .verificationChecks.create({ to: phone, code });
