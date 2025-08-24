// utils/stripe/server.js
// -----------------------------------------------------------------------------
// Stripe has been removed from the project. This stub exists purely so that
// legacy imports (`import { stripe } from '@/utils/stripe/server'`) continue to
// resolve while we migrate all code paths. Every method returns a minimal
// object that satisfies callers but **does not** contact Stripe.
// -----------------------------------------------------------------------------

export const stripe = {
  paymentIntents: {
    create: async (params) => ({
      id: 'sim_pi_' + crypto.randomUUID(),
      client_secret: 'sim_client_secret',
      status: 'succeeded',
      ...params,
    }),
    retrieve: async (id) => ({ id, status: 'succeeded' }),
  },
  refunds: {
    create: async () => ({ id: 'sim_refund_' + crypto.randomUUID() }),
  },
  customers: {
    create: async () => ({ id: 'sim_cust_' + crypto.randomUUID() }),
  },
  accounts: {
    create: async () => ({ id: 'sim_acct_' + crypto.randomUUID() }),
    retrieve: async (id) => ({ id }),
    createLoginLink: async () => ({ url: 'https://example.com/login' }),
  },
  accountLinks: {
    create: async () => ({ url: 'https://example.com/onboard' }),
  },
  webhooks: {
    constructEvent: () => ({ type: 'simulated.event', data: { object: {} } }),
  },
}; 