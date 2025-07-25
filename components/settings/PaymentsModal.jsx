// components/settings/PaymentsModal.jsx
"use client";
import { useState, useEffect } from 'react';
import BaseModal from './BaseModal';

// Simple modal informing hosts that payouts are simulated in dev.

export default function PaymentsModal({ open, onClose }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    (async () => {
      await fetch('/api/payouts/status').catch(() => {});
      setLoading(false);
    })();
  }, [open]);

  return (
    <BaseModal open={open} onClose={onClose}>
      <h2 className="text-lg font-bold mb-4">Payouts (Simulated)</h2>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <p className="text-green-700">Payouts are automatically simulated when your event ends. No onboarding required.</p>
      )}
    </BaseModal>
  );
} 