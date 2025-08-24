"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LockModal({ until }) {
  const router = useRouter();
  // Close modal by navigating back to /host
  const onClose = () => router.replace("/host");

  /* countdown state */
  const [remainStr, setRemainStr] = useState(formatRemain());

  useEffect(() => {
    const id = setInterval(() => {
      setRemainStr(formatRemain());
    }, 1000);
    return () => clearInterval(id);
  }, [until]);

  function formatRemain() {
    if (!until) return "";
    const ms = new Date(until) - Date.now();
    if (ms <= 0) return "0s";
    const sec = Math.floor(ms / 1000);
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d >= 60) return "2 months";
    if (d >= 14) return "2 weeks";
    if (d >= 1) return `${d}d ${h}h`;
    if (h >= 1) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  }

  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4 text-center">
        <h2 className="text-lg font-bold">Posting Locked</h2>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">
          You’ve cancelled two events with RSVPs.
          To keep things fair for guests, posting is paused for {remainStr}.
        </p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
        >
          Got it
        </button>
      </div>
    </div>
  );
} 