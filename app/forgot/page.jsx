'use client'

import { useState } from 'react'

export default function ForgotPage(){
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e){
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try{
      const res = await fetch('/api/auth/reset/request',{
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if(!res.ok) throw new Error(data.error||'Failed to send reset email')
      setSent(true)
    }catch(err){ setError(err.message||'Error') }
    finally{ setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8 bg-white rounded-xl shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Reset Password</h1>
        {sent ? (
          <p className="text-green-600 text-center">If that email exists, we sent a reset link.</p>
        ):(
          <>
            {error && <p className="mb-4 text-red-500 text-center">{error}</p>}
            <label className="block mb-6">
              <span className="text-sm font-medium">Email</span>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="mt-1 block w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300" />
            </label>
            <button type="submit" disabled={loading} className={`w-full py-2 text-white rounded ${loading?'bg-gray-400':'bg-blue-600 hover:bg-blue-700'}`}>
              {loading? 'Sending…' : 'Send reset link'}
            </button>
            <p className="mt-6 text-center text-sm text-gray-500">
              <a href="/login" className="text-blue-600 hover:underline">Back to login</a>
            </p>
          </>
        )}
      </form>
    </div>
  )
}


