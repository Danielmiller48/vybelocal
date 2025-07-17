"use client";

import Link from "next/link";

export default function HostNextEventCard({ event, paidCount, unpaidCount, expectedPayout }) {
  if (!event) return null;
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <h2 className="text-xl font-bold truncate mb-1">{event.title}</h2>
        <p className="text-sm text-gray-600 mb-2">
          {new Date(event.starts_at).toLocaleString()} • {event.vibe}
        </p>
        <p className="text-sm">RSVPs: <span className="font-medium">{paidCount + unpaidCount}</span> (<span className="text-green-700">{paidCount} paid</span> / {unpaidCount} unpaid)</p>
        <p className="text-sm">Expected payout: <span className="font-medium">${expectedPayout.toFixed(2)}</span></p>
        <p className="text-xs mt-1">Refund policy: {event.refund_policy.replace("_"," ")}</p>
      </div>
      <div className="flex gap-2 shrink-0 flex-wrap">
        <Link href={`/host/events/${event.id}`} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700">Edit</Link>
        <Link href={`/vybes/${event.id}`} className="px-3 py-1 rounded bg-gray-200 text-sm hover:bg-gray-300">View RSVPs</Link>
        <button className="px-3 py-1 rounded bg-gray-200 text-sm hover:bg-gray-300" onClick={()=>navigator.clipboard.writeText(`${window.location.origin}/vybes/${event.id}`)}>Copy Link</button>
      </div>
    </div>
  );
} 