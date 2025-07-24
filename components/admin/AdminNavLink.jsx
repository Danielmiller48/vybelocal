// components/admin/AdminNavLink.jsx
"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/utils/supabase/client';

export default function AdminNavLink() {
  const sb = createSupabaseBrowser();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    (async () => {
      const [flagCntRes, reviewCntRes] = await Promise.all([
        sb.from('flags').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        sb.from('ai_cancellation_reviews').select('*', { count: 'exact', head: true }).is('reviewed_by', null),
      ]);
      setPending((flagCntRes.count || 0) + (reviewCntRes.count || 0));
    })();
  }, []);

  return (
    <Link href="/admin/dashboard" className="relative hover:text-violet-600">
      Admin
      {pending > 0 && (
        <span className="absolute -top-1 -right-3 bg-red-600 text-white text-[10px] leading-none rounded-full px-1">
          {pending}
        </span>
      )}
    </Link>
  );
} 