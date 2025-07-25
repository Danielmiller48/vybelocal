// components/payments/PaymentForm.jsx
// -----------------------------------------------------------------------------
// Simulation payment form – bypasses Stripe and marks payment as complete.
// -----------------------------------------------------------------------------
// Props:
//   • eventId – UUID of the event being paid for
//   • amount  – price in cents (integer)
//   • onSuccess – callback when payment succeeds
//   • onError   – callback when an error occurs
// -----------------------------------------------------------------------------

'use client';

import { useState } from 'react';

export default function PaymentForm({ eventId, amount, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, amount }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json.error || 'Payment failed');
      onSuccess?.();
    } catch (err) {
      console.error(err);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-center">
        You will be charged <span className="font-semibold">${(amount / 100).toFixed(2)}</span> (simulation).
      </p>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Processing…' : 'Confirm Payment'}
      </button>
    </form>
  );
} 