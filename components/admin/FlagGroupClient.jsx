"use client";
import React from "react";

export default function FlagGroupClient({ profile, flags, onStatusChange }) {
  async function handleBulkStatusUpdate(status) {
    await fetch("/api/flags/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.id, status }),
    });
    onStatusChange && onStatusChange();
  }

  function renderDetails(details) {
    if (!details) return <span className="italic text-gray-400">No additional details.</span>;
    if (typeof details === "string") {
      return <span>User provided details: "{details}"</span>;
    }
    if (typeof details === "object") {
      if (details.matched === "scam/self-promo regex") {
        return <span>Flagged by scam/self-promo filter. Text: "{details.text}"</span>;
      }
      if (details.ai_result) {
        const categories = Object.entries(details.ai_result.results?.[0]?.categories || {})
          .filter(([k, v]) => v)
          .map(([k]) => k.replace(/_/g, " ")).join(", ");
        return <span>Flagged by AI moderation. Text: "{details.text}"{categories ? `. Categories: ${categories}` : ""}</span>;
      }
      if (details.results && Array.isArray(details.results)) {
        const categories = Object.entries(details.results[0]?.categories || {})
          .filter(([k, v]) => v)
          .map(([k]) => k.replace(/_/g, " ")).join(", ");
        return <span>Flagged by AI moderation.{categories ? ` Categories: ${categories}` : ""}</span>;
      }
      if (details.text) {
        return <span>Flagged content: "{details.text}"</span>;
      }
      return <pre className="whitespace-pre-wrap break-all text-xs bg-gray-50 p-2 rounded max-h-32 overflow-auto">{JSON.stringify(details, null, 2)}</pre>;
    }
    return <span className="italic text-gray-400">No additional details.</span>;
  }

  return (
    <details className="bg-white border rounded shadow">
      <summary className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50">
        <img src={profile?.signed_avatar_url || "/avatar-placeholder.png"} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
        <span className="font-semibold">{profile?.name || profile.id}</span>
        <span className="text-xs text-gray-500">{profile?.email}</span>
        <span className="text-xs text-gray-500">{profile?.phone}</span>
        <span className="ml-auto text-xs text-gray-400">{flags.length} flag{flags.length > 1 ? "s" : ""}</span>
      </summary>
      <div className="overflow-x-auto p-4">
        <table className="min-w-full bg-white border rounded">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Target ID</th>
              <th className="p-2 text-left">Reason</th>
              <th className="p-2 text-left">Severity</th>
              <th className="p-2 text-left">Created</th>
              <th className="p-2 text-left">Details</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => (
              <tr key={flag.id} className="border-b last:border-0">
                <td className="p-2 font-mono text-xs">{flag.target_type}</td>
                <td className="p-2 font-mono text-xs">{flag.target_id}</td>
                <td className="p-2">{flag.reason_code || <span className="italic text-gray-400">None</span>}</td>
                <td className="p-2 text-center">{flag.severity}</td>
                <td className="p-2 text-xs">{new Date(flag.created_at).toLocaleString()}</td>
                <td className="p-2 text-xs max-w-xs truncate">{renderDetails(flag.details)}</td>
                <td className="p-2 text-xs">{flag.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Bulk status update buttons */}
        <div className="flex gap-2 mt-4">
          <button type="button" className="btn btn-sm bg-blue-100 text-blue-700" onClick={() => handleBulkStatusUpdate("reviewed")}>Mark All as Reviewed</button>
          <button type="button" className="btn btn-sm bg-green-100 text-green-700" onClick={() => handleBulkStatusUpdate("actioned")}>Action All</button>
          <button type="button" className="btn btn-sm bg-gray-100 text-gray-700" onClick={() => handleBulkStatusUpdate("dismissed")}>Dismiss All</button>
        </div>
      </div>
    </details>
  );
} 