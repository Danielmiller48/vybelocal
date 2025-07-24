// components/settings/PaymentsModal.jsx
"use client";
import { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import toast from 'react-hot-toast';

export default function PaymentsModal({ open, onClose }) {
  const [status, setStatus] = useState('loading'); // loading | incomplete | complete
  const [link, setLink] = useState(null);
  const [dashboardUrl, setDashboardUrl] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const res = await fetch('/api/stripe/connect/status');
      if (!res.ok) { setStatus('incomplete'); return; }
      const data = await res.json();
      setStatus(data.enabled ? 'complete' : 'incomplete');
      setDashboardUrl(data.dashboard_url);
    })();
  }, [open]);

  async function handleOnboard() {
    if(busy) return;
    setBusy(true);
    const res = await fetch('/api/stripe/connect/onboard', { method:'POST' });
    const data = await res.json();
    if (!data.url) { toast.error('Failed to start onboarding'); setBusy(false); return; }
    const popup = window.open(data.url, '_blank', 'width=480,height=720');
    if (!popup) { window.location.href = data.url; return; }

    // Poll status every 4s until popup closed and account enabled
    const poll = setInterval(async () => {
      if (popup.closed) {
        const st = await fetch('/api/stripe/connect/status').then(r=>r.json());
        if (st.enabled) {
          setStatus('complete');
          setDashboardUrl(st.dashboard_url);
          clearInterval(poll);
          setBusy(false);
        } else {
          // still incomplete, maybe user cancelled; stop polling
          clearInterval(poll);
          setBusy(false);
        }
      }
    }, 4000);
  }

  return (
    <BaseModal open={open} onClose={onClose}>
      <h2 className="text-lg font-bold mb-4">Payments & Payouts</h2>

      {status === 'loading' && <p>Loading…</p>}

      {status === 'complete' && (
        <div className="space-y-2">
          <p className="text-green-700">Your Stripe account is fully set up. You can receive payouts.</p>
          <a href={dashboardUrl} className="btn primary" target="_blank" rel="noreferrer">Open Stripe Dashboard</a>
        </div>
      )}

      {status === 'incomplete' && (
        <div className="space-y-2">
          <p className="text-yellow-700">Finish Stripe onboarding to start receiving payouts for paid events.</p>
          <button
            onClick={handleOnboard}
            disabled={busy}
            className={`px-4 py-2 rounded text-white font-medium transition disabled:opacity-50 ${busy ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >{busy ? 'Opening…' : 'Start Stripe Setup'}</button>
        </div>
      )}
    </BaseModal>
  );
} 