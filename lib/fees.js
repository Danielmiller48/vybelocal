// lib/fees.js
// ----------------------------------------------
// Helper to calculate Stripe + platform fees and
// grand-total user pays.
// ----------------------------------------------

export function calcFees(baseCents) {
  baseCents = Number(baseCents || 0);
  // Platform fee: 7% of base, minimum 70¢
  const platform = Math.max(Math.round(baseCents * 0.07), 70);

  // Stripe fee is 2.9% + 30¢ *on the total amount collected* (which includes
  // the fee itself). Solve:
  //   total = base + platform + stripe
  //   stripe = 0.029 * total + 30
  // → stripe = (0.029*(base+platform) + 30) / (1 - 0.029)
  const stripe = Math.round((0.029 * (baseCents + platform) + 30) / (1 - 0.029));

  return {
    stripe,
    platform,
    total: baseCents + platform + stripe,
  };
} 