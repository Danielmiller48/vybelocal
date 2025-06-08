"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function AdminStatusTabs() {
  const router = useRouter();
  const search = useSearchParams();
  const status = search.get("status") ?? "pending";

  /* helper to update the ?status= query param */
  function setStatus(newStatus) {
    const qs = new URLSearchParams(search);
    qs.set("status", newStatus);
    router.push(`/admin/dashboard?${qs.toString()}`);
  }

  /* render one tab button */
  const tab = (label) => (
    <button
      key={label}
      onClick={() => setStatus(label)}
      className={
        "px-4 py-2 rounded-t " +
        (status === label
          ? "bg-white border-t border-x"
          : "bg-gray-200 hover:bg-gray-300")
      }
    >
      {label[0].toUpperCase() + label.slice(1)}
    </button>
  );

  return (
    <div className="flex space-x-1 border-b mb-4">
      {["pending", "approved", "rejected", "history"].map(tab)}
    </div>
  );
}
