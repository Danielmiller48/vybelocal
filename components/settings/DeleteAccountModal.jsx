// components/settings/DeleteAccountModal.jsx
"use client";
import { useState } from 'react';
import BaseModal from './BaseModal';
import { signOut } from 'next-auth/react';

export default function DeleteAccountModal({ open, onClose }) {
  const [busy, setBusy] = useState(false);

  async function doDelete() {
    if (!confirm('This cannot be undone. Delete your account permanently?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/user/delete', { method:'DELETE' });
      if (!res.ok) throw new Error('Failed');
      await signOut({ callbackUrl:'/' });
    } catch (err) {
      alert(err.message || 'Error');
    } finally { setBusy(false); }
  }

  return (
    <BaseModal open={open} onClose={onClose}>
      <h2 className="text-lg font-bold mb-4 text-red-600">Delete Account</h2>
      <p className="mb-4 text-sm">
        This will permanently delete your profile, events, and RSVPs. This action cannot be undone.
      </p>
      <div className="flex justify-end gap-2">
        <button className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm" onClick={doDelete} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</button>
      </div>
    </BaseModal>
  );
} 