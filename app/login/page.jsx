'use client'

import { useState, useEffect } from 'react'
import { signIn }              from 'next-auth/react'
import { useRouter }           from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  /* ─ state ─ */
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [error,        setError]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [justVerified, setJustVerified] = useState(false)

  /* ─ banner if ?verified=1 ─ */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('verified') === '1') {
      setJustVerified(true)
      params.delete('verified')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  /* ─ submit ─ */
  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')

    const res = await signIn('credentials', {
      redirect : false,
      email,
      password,
    })

    setSubmitting(false)

    if (res?.error) {
      setError(res.error)
    } else {
      /* 🔄 soft-refresh so header picks up the new session immediately */
      router.replace('/')   // change URL
      router.refresh()      // re-render RSC & client tree
    }
  }

  /* ─ UI ─ */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-8 bg-white rounded-xl shadow-md"
      >
        <h1 className="text-2xl font-bold mb-6 text-center">Log In</h1>

        {justVerified && (
          <p className="mb-4 text-green-600 text-center">
            Email confirmed! Please log in.
          </p>
        )}

        {error && (
          <p className="mb-4 text-red-500 text-center">{error}</p>
        )}

        {/* Email */}
        <label className="block mb-4">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
          />
        </label>

        {/* Password */}
        <label className="block mb-6">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
          />
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className={`w-full py-2 text-white rounded ${
            submitting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {submitting ? 'Logging in…' : 'Log In'}
        </button>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don’t have an account?{' '}
          <a href="/register" className="text-blue-600 hover:underline">
            Register
          </a>
        </p>
      </form>
    </div>
  )
}