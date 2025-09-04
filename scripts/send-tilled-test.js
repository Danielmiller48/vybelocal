// scripts/send-tilled-test.js
// Send a signed, Tilled-style webhook to our endpoint for local testing.
// Usage (PowerShell):
//   $env:TILLED_WEBHOOK_SECRET="<YOUR_SECRET>"; node ./scripts/send-tilled-test.js caps acct_XXXXXXXX
//   $env:TILLED_WEBHOOK_SECRET="<YOUR_SECRET>"; node ./scripts/send-tilled-test.js fallback acct_XXXXXXXX
// Where "caps" includes an active capability in the payload;
// "fallback" sends no capabilities so the server calls /v1/accounts.

const crypto = require('crypto');
const https = require('https');

const WEBHOOK_URL = 'https://vybelocal.com/api/payments/tilled/webhook';
const SECRET = process.env.TILLED_WEBHOOK_SECRET;

const mode = (process.argv[2] || 'caps').toLowerCase(); // 'caps' | 'fallback'
const accountId = process.argv[3] || 'acct_r3Ia8kWg5mPuzDGW9yvFQ';

if (!SECRET) {
  console.error('Missing TILLED_WEBHOOK_SECRET env. Set it before running.');
  process.exit(1);
}

const base = {
  id: `evt_test_${Date.now()}`,
  type: 'account.updated',
  account_id: accountId,
  data: {}
};

if (mode === 'caps') {
  base.data.capabilities = [{ id: 'pp_test', status: 'active' }];
} else {
  base.data.capabilities = [];
}

const payload = JSON.stringify(base);
const ts = Date.now().toString();
const sig = crypto.createHmac('sha256', SECRET).update(`${ts}.${payload}`).digest('hex');

const req = https.request(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'payments-signature': `t=${ts},v1=${sig}`
  }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => console.log('Webhook returned:', res.statusCode, body));
});

req.on('error', e => console.error('Request error:', e.message));
req.write(payload);
req.end();




