//register/page.jsx//
// Updated RegisterPage with phone-duplicate error handling + banner-reset
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

/*  Helper: format 10-digit US number as XXX-XXX-XXXX while typing   */
const formatPhone = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
};

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState('form');

  /*  form fields  */
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [password,  setPassword]  = useState('');
  const [code,      setCode]      = useState('');

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  /* ---------- client-side validation ---------- */
  const validEmail  = /^\S+@\S+\.\S+$/.test(email);
  const validPhone  = /^\d{3}-\d{3}-\d{4}$/.test(phone);
  const validPwd    = password.length >= 8;
  const namesFilled = firstName.trim() && lastName.trim();

  /* Helper to get combined full name */
  const fullName = `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, ' ');

  /* ---------- 1 · send SMS ---------- */
  async function handleStart(e) {
    e.preventDefault();
    if (!validEmail || !validPhone || !validPwd || !namesFilled) {
      setError('Please fix the highlighted fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/register/signup', {
        name: fullName,
        email,
        phone: `+1${phone.replace(/\D/g, '')}`,   // E.164 for Twilio
        password,
      });
      setError('');            // ✱ CLEAR ANY OLD BANNER
      setLoading(false);       // re-enable button / spinner
      setStep('code');         // advance UI
    } catch (err) {
      // show EXACTLY what the API returned when it’s a string
      const apiMsg = err.response?.data;
      setError(typeof apiMsg === 'string'
        ? apiMsg                     // “email/phone already in use”
        : 'Signup error, try again.'); // fallback
      setLoading(false);
    }
  }

  /* ---------- 2 · submit code ---------- */
  async function handleVerify(e) {
    e.preventDefault();
    if (code.length !== 6) { setError('Enter the 6-digit code.'); return; }
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/register/verify', {
        name: fullName,
        email,
        phone: `+1${phone.replace(/\D/g, '')}`,
        password,
        code,
      });
      setError('');            // ✱ CLEAR BANNER
      setLoading(false);
      // success → straight to login page
      router.push('/login?new=1');
    } catch (err) {
      const apiMsg = err.response?.data;
      setError(typeof apiMsg === 'string' ? apiMsg : 'Signup error, try again.');
      setLoading(false);
    }
  }

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow space-y-6">
        {step === 'form' && (
          <form onSubmit={handleStart} className="space-y-4">
            <h1 className="text-2xl font-bold text-center">Create account</h1>

            {/* First & Last name fields */}
            <div className="flex gap-2">
              <input
                placeholder="First name"
                value={firstName}
                onChange={(e)=>setFirstName(e.target.value)}
                className={`w-1/2 border rounded px-3 py-2 ${
                  !firstName.trim() && error ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <input
                placeholder="Last name"
                value={lastName}
                onChange={(e)=>setLastName(e.target.value)}
                className={`w-1/2 border rounded px-3 py-2 ${
                  !lastName.trim() && error ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              className={`w-full border rounded px-3 py-2 ${
                !validEmail && error ? 'border-red-500' : 'border-gray-300'
              }`}
            />

            <input
              placeholder="123-456-7890"
              value={phone}
              onChange={(e)=>setPhone(formatPhone(e.target.value))}
              className={`w-full border rounded px-3 py-2 ${
                !validPhone && error ? 'border-red-500' : 'border-gray-300'
              }`}
            />

            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              className={`w-full border rounded px-3 py-2 ${
                !validPwd && error ? 'border-red-500' : 'border-gray-300'
              }`}
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 text-white rounded ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Sending…' : 'Continue'}
            </button>

            <p className="text-center text-sm text-gray-500">
              Already verified?{' '}
              <a href="/login" className="text-blue-600 underline">Log in</a>
            </p>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <h1 className="text-2xl font-bold text-center">Verify number</h1>
            <p className="text-center text-gray-600">
              We just texted <strong>{phone}</strong>.  
              Enter the 6-digit code to finish signup.
            </p>

            <input
              autoFocus
              placeholder="123456"
              value={code}
              onChange={(e)=>setCode(e.target.value.replace(/\D/g, '').slice(0,6))}
              className="w-full border rounded px-3 py-2 text-center tracking-widest text-xl"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 text-white rounded ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Verifying…' : 'Verify & Create'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
