"use client";

import { useRouter, useSearchParams } from "next/navigation";

const vibes = ["all", "chill", "creative", "active", "hype"];

export default function VibeTabs() {
  const router = useRouter();
  const search = useSearchParams();
  const vibe   = (search.get("vibe") ?? "all").toLowerCase();

  function set(v) {
    const qs = new URLSearchParams(search);
    v === "all" ? qs.delete("vibe") : qs.set("vibe", v);
    router.push(`/admin/metrics?${qs.toString()}`);
  }

  const cls = (v) =>
    `px-3 py-1 rounded-t ${
      v === vibe ? "bg-white border-t border-x" : "bg-gray-200 hover:bg-gray-300"
    }`;

  return (
    <div className="flex space-x-1 border-b mb-4">
      {vibes.map((v) => (
        <button key={v} onClick={() => set(v)} className={cls(v)}>
          {v.charAt(0).toUpperCase() + v.slice(1)}
        </button>
      ))}
    </div>
  );
}
