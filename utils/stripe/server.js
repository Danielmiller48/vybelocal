// utils/stripe/server.js
// -------------------------------------------------------------
// Centralised Stripe server SDK wrapper. Import this file in API
// routes or server components to get a pre-configured Stripe
// instance that automatically uses the project secret key and
// latest API version. Keeps key out of client bundles.
// -------------------------------------------------------------

import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
}

export const stripe = new Stripe(secretKey, {
  apiVersion: '2024-04-10',
  appInfo: {
    name: 'VybeLocal',
    version: '1.0.0',
  },
}); 