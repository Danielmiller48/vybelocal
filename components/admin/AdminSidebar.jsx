"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function AdminSidebar() {
  const pathname = usePathname();
  const search   = useSearchParams();
  const status   = search.get("status") ?? "pending";

  const isDash    = pathname.startsWith("/admin/dashboard");
  const isMetrics = pathname.startsWith("/admin/metrics");

  /* small helper to style active link */
  const cls = (active) =>
    `block px-4 py-2 rounded ${
      active ? "bg-indigo-600 text-white" : "hover:bg-gray-200"
    }`;

  return (
    <aside className="w-52 p-4 border-r sticky top-0 self-start h-screen bg-white">
      <h2 className="font-bold mb-4">Admin</h2>

      <nav className="space-y-1">
  <Link href="/admin/dashboard"        className={cls(isDash && !pathname.includes("?"))}>Dashboard</Link>
  <div className="pl-3 space-y-1 text-sm">
    <Link href="/admin/dashboard?status=pending"  className={cls(isDash && status==="pending")}>Pending</Link>
    <Link href="/admin/dashboard?status=approved" className={cls(isDash && status==="approved")}>Approved</Link>
    <Link href="/admin/dashboard?status=rejected" className={cls(isDash && status==="rejected")}>Rejected</Link>
    <Link href="/admin/dashboard?status=history" className={cls(isDash && status==="history")}>History</Link>
  </div>

  <Link href="/admin/metrics" className={cls(isMetrics)}>Metrics</Link>
  <Link href="/admin/flags"   className={cls(pathname.startsWith("/admin/flags"))}>Flags</Link>
</nav>
    </aside>
  );
}
