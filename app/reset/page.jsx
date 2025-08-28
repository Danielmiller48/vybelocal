'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '../../utils/supabase/client'

export default function ResetPage(){
  const supabase = createSupabaseBrowser()
  const [newPwd, setNewPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(()=>{
    // when arriving from email, supabase sets a recovery session; nothing to do here.
  },[])

  async function submit(e){
    e.preventDefault()
    if(saving) return
    setSaving(true)
    setErr('')
    try{
      if(!newPwd || newPwd.length < 8) throw new Error('Password must be at least 8 characters')
      if(newPwd !== confirm) throw new Error('Passwords do not match')
      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if(error) throw error
      setDone(true)
    }catch(e){ setErr(e.message||'Failed to reset password') } finally{ setSaving(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={submit} className="w-full max-w-md p-8 bg-white rounded-xl shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Set a new password</h1>
        {done ? (
          <p className="text-green-600 text-center">Password updated. You can close this page and log in.</p>
        ) : (
          <>
            {err && <p className="mb-4 text-red-500 text-center">{err}</p>}
            <label className="block mb-4">
              <span className="text-sm font-medium">New password</span>
              <input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} required className="mt-1 block w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300" />
            </label>
            <label className="block mb-6">
              <span className="text-sm font-medium">Confirm password</span>
              <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required className="mt-1 block w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300" />
            </label>
            <button type="submit" disabled={saving} className={`w-full py-2 text-white rounded ${saving?'bg-gray-400':'bg-blue-600 hover:bg-blue-700'}`}>
              {saving?'Updating…':'Update password'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}


