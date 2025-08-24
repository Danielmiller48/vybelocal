"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/utils/supabase/client";

export default function AdminSidebar() {
  const pathname = usePathname();
  const search   = useSearchParams();
  const status   = search.get("status") ?? "pending";

  const sb = createSupabaseBrowser();

  const [counts,setCounts]=useState({pending:0,flags:0,cancels:0});

  useEffect(()=>{
    (async()=>{
      const [{ count: pendCnt }, { count: flagCnt }, { count: cancelCnt }] = await Promise.all([
        sb.from('events').select('*',{count:'exact',head:true}).eq('status','pending'),
        sb.from('flags').select('*',{count:'exact',head:true}).eq('status','pending'),
        sb.from('ai_cancellation_reviews').select('*',{count:'exact',head:true}).is('reviewed_by',null),
      ]);
      setCounts({pending:pendCnt||0, flags:flagCnt||0, cancels:cancelCnt||0});
    })();
  },[]);

  const badge = (n)=> n>0 ? (<span className="ml-2 bg-red-600 text-white rounded-full text-xs px-1.5">{n}</span>) : null;

  const isDash    = pathname.startsWith("/admin/dashboard");
  const isMetrics = pathname.startsWith("/admin/metrics");
  const isCancels = pathname.startsWith("/admin/cancellations");

  /* small helper to style active link */
  const cls = (active) =>
    `flex items-center justify-between px-4 py-2 rounded ${
      active ? "bg-indigo-600 text-white" : "hover:bg-gray-200"
    }`;

  return (
    <aside className="w-52 p-4 border-r sticky top-0 self-start h-screen bg-white">
      <h2 className="font-bold mb-4">Admin</h2>

      <nav className="space-y-1 text-sm">
        <Link href="/admin/dashboard" className={cls(isDash && !pathname.includes("?"))}>Dashboard</Link>
        <div className="pl-3 space-y-1">
          <Link href="/admin/dashboard?status=pending"  className={cls(isDash && status==='pending')}>Pending {badge(counts.pending)}</Link>
          <Link href="/admin/dashboard?status=approved" className={cls(isDash && status==='approved')}>Approved</Link>
          <Link href="/admin/dashboard?status=rejected" className={cls(isDash && status==='rejected')}>Rejected</Link>
          <Link href="/admin/dashboard?status=history"  className={cls(isDash && status==='history')}>History</Link>
        </div>

        <Link href="/admin/metrics"  className={cls(isMetrics)}>Metrics</Link>
        <Link href="/admin/revenue"  className={cls(pathname.startsWith('/admin/revenue'))}>Revenue</Link>
        <Link href="/admin/flags"    className={cls(pathname.startsWith('/admin/flags'))}>Flags {badge(counts.flags)}</Link>
        <Link href="/admin/cancellations" className={cls(isCancels)}>Cancellations {badge(counts.cancels)}</Link>
      </nav>
    </aside>
  );
}
