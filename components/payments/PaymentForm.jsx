// components/payments/PaymentForm.jsx
// -----------------------------------------------------------------------------
// Reusable payment form for paying for an event RSVP.
// Props:
//   • eventId   – UUID of the event the user is paying for
//   • amount    – price in cents (integer)
// -----------------------------------------------------------------------------

'use client'
console.log('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
import { useEffect, useState, useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)

/* ─────────────────────────── internal checkout form ───────────────────────── */
function CheckoutForm({ onSuccess, onError }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError(null)

    const { error: stripeErr } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href }, // optional redirect
      redirect: 'if_required',
    })

    if (stripeErr) {
      setError(stripeErr.message)
      onError?.(stripeErr)
    } else {
      onSuccess?.()
    }
    setLoading(false)
  }, [stripe, elements, onSuccess, onError])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement id="payment-element" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-violet-700 hover:bg-violet-800 text-white py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Processing…' : 'Pay'}
      </button>
    </form>
  )
}

/* ───────────────────────────── PaymentForm ──────────────────────────────── */
export default function PaymentForm({ eventId, amount, onSuccess, onError }) {
  const [clientSecret, setClientSecret] = useState(null)
  const [fetchErr, setFetchErr] = useState(null)

  useEffect(() => {
    let aborted = false

    async function createIntent() {
      try {
        const res = await fetch('/api/payments/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, amount }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Server error')
        if (aborted) return
        setClientSecret(data.client_secret)
      } catch (err) {
        if (!aborted) setFetchErr(err.message)
        onError?.(err)
      }
    }

    if (eventId && amount) createIntent()
    return () => { aborted = true }
  }, [eventId, amount, onError])

  if (fetchErr) {
    return <p className="text-red-600 text-sm">{fetchErr}</p>
  }

  if (!clientSecret) {
    return <p>Loading payment form…</p>
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm onSuccess={onSuccess} onError={onError} />
    </Elements>
  )
} 