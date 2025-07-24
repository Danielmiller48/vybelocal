"use client";
import { useState } from 'react';

export default function ReviewActionForm({ reviewId, action, label, colorClass }) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      action={`/api/admin/cancel-reviews/${reviewId}`}
      method="post"
      className="inline-block"
      onSubmit={() => setSubmitting(true)}
    >
      <input type="hidden" name="action" value={action} />
      <input
        type="text"
        name="note"
        placeholder="Message to host"
        className="border px-1 py-0.5 text-xs mr-1"
        disabled={submitting}
      />
      <button
        type="submit"
        disabled={submitting}
        className={`px-2 py-1 ${colorClass} text-white rounded text-xs`}
      >
        {submitting ? 'Sending…' : label}
      </button>
    </form>
  );
} 