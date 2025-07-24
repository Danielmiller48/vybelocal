// components/settings/PhoneForm.jsx
"use client";
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function PhoneForm() {
  const [phone,setPhone]=useState('');
  const [step,setStep]=useState('enter'); // enter | code
  const [code,setCode]=useState('');
  const [busy,setBusy]=useState(false);

  async function sendCode(){
    setBusy(true);
    try{
      const res=await fetch('/api/phone/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})});
      const j=await res.json();
      if(!res.ok) throw new Error(j.error||'Error');
      setStep('code');
      toast.success('Code sent');
    }catch(err){toast.error(err.message);}finally{setBusy(false);}  }

  async function verify(){
    setBusy(true);
    try{
      const res=await fetch('/api/phone/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,code})});
      const j=await res.json();
      if(!res.ok) throw new Error(j.error||'Error');
      toast.success('Phone verified');
      setStep('done');
    }catch(err){toast.error(err.message);}finally{setBusy(false);}  }

  const formatPhone=(v)=>{
    const d=v.replace(/[^\d]/g,'').slice(0,10);
    const parts=[d.slice(0,3),d.slice(3,6),d.slice(6)];
    return parts.filter(Boolean).join('-');
  };

  if(step==='enter') return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">New phone number</label>
      <input value={phone} onChange={e=>setPhone(formatPhone(e.target.value))} className="input w-full" placeholder="555-123-4567" />
      <button onClick={sendCode} disabled={busy||phone.replace(/[^\d]/g,'').length!==10} className="btn primary">Send Code</button>
    </div>
  );
  if(step==='code') return (
    <div className="space-y-4">
      <p className="text-sm">Enter the 6-digit code we just sent to {phone}.</p>
      <input value={code} onChange={e=>setCode(e.target.value)} className="input w-full" maxLength={6} />
      <button onClick={verify} disabled={busy||code.length!==6} className="btn primary">Verify</button>
    </div>
  );
  return <p className="text-green-700">Phone updated ✓</p>;
} 