"use client";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/utils/supabase/client";
import AdminFlagsClient from '@/components/admin/AdminFlagsClient';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'actioned', label: 'Actioned' },
  { value: 'dismissed', label: 'Dismissed' },
];

function groupFlagsByUser(flags, profiles) {
  const grouped = {};
  for (const flag of flags) {
    const userId = flag.user_id;
    if (!userId) continue;
    if (!grouped[userId]) grouped[userId] = { profile: profiles[userId], flags: [] };
    grouped[userId].flags.push(flag);
  }
  return grouped;
}

function renderDetails(details) {
  if (!details) return <span className="italic text-gray-400">No additional details.</span>;
  if (typeof details === 'string') {
    return <span>User provided details: "{details}"</span>;
  }
  if (typeof details === 'object') {
    if (details.matched === 'scam/self-promo regex') {
      return <span>Flagged by scam/self-promo filter. Text: "{details.text}"</span>;
    }
    if (details.ai_result) {
      const categories = Object.entries(details.ai_result.results?.[0]?.categories || {})
        .filter(([k, v]) => v)
        .map(([k]) => k.replace(/_/g, ' ')).join(', ');
      return <span>Flagged by AI moderation. Text: "{details.text}"{categories ? `. Categories: ${categories}` : ''}</span>;
    }
    if (details.results && Array.isArray(details.results)) {
      const categories = Object.entries(details.results[0]?.categories || {})
        .filter(([k, v]) => v)
        .map(([k]) => k.replace(/_/g, ' ')).join(', ');
      return <span>Flagged by AI moderation.{categories ? ` Categories: ${categories}` : ''}</span>;
    }
    if (details.text) {
      return <span>Flagged content: "{details.text}"</span>;
    }
    return <pre className="whitespace-pre-wrap break-all text-xs bg-gray-50 p-2 rounded max-h-32 overflow-auto">{JSON.stringify(details, null, 2)}</pre>;
  }
  return <span className="italic text-gray-400">No additional details.</span>;
}

export default function FlagsPage() {
  const search = useSearchParams();
  const statusFilter = search.get("status") ?? "pending";
  const [flags, setFlags] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowser();

  useEffect(() => {
    setLoading(true);
    setFlags(null);
    (async () => {
      // 1. Fetch all flags
      const { data: flagsData, error } = await supabase
        .from('flags')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        setFlags([]);
        setLoading(false);
        return;
      }
      // 2. Fetch all user profiles for flagged users
      let userIds = [...new Set((flagsData || []).map(f => f.user_id).filter(Boolean))];
      userIds = userIds.map(id => id.toString().trim());
      let profilesMap = {};
      if (userIds.length) {
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('id, name, email, phone, avatar_url, warning_issued, soft_ban_expires_at, is_permanently_banned')
          .in('id', userIds);
        if (userProfiles) {
          for (const p of userProfiles) {
            if (p.avatar_url) {
              if (p.avatar_url.startsWith('http')) {
                p.signed_avatar_url = p.avatar_url;
              } else {
                const { data: signed } = await supabase.storage
                  .from('profile-images')
                  .createSignedUrl(p.avatar_url, 60 * 60);
                p.signed_avatar_url = signed?.signedUrl || '/avatar-placeholder.png';
              }
            } else {
              p.signed_avatar_url = '/avatar-placeholder.png';
            }
            profilesMap[p.id] = p;
          }
        }
      }
      setProfiles(profilesMap);
      setFlags(flagsData);
      setLoading(false);
    })();
  }, [statusFilter]);

  // Calculate counts for each status from the raw flags array
  const statusCounts = STATUS_OPTIONS.reduce((acc, opt) => {
    acc[opt.value] = flags ? (opt.value === 'all'
      ? flags.length
      : flags.filter(f => f.status === opt.value).length) : 0;
    return acc;
  }, {});

  // Filter flags by status before grouping
  const filteredFlags = flags ? (statusFilter === 'all'
    ? flags
    : flags.filter(f => f.status === statusFilter)) : [];

  // Group the filtered flags by user
  const grouped = groupFlagsByUser(filteredFlags, profiles);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">All Flags</h1>
      <div className="mb-4 text-sm text-gray-600">Grouped by responsible user. Click a user to view all their flags. Sorting/filtering coming soon.</div>
      <div className="flex gap-2 mb-6">
        {STATUS_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`?status=${opt.value}`}
            className={`px-4 py-2 rounded ${statusFilter === opt.value ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            {opt.label} {statusCounts[opt.value] !== undefined && (
              <span className="ml-1 text-xs bg-white/30 rounded px-2 py-0.5">{statusCounts[opt.value]}</span>
            )}
          </Link>
        ))}
      </div>
      {loading ? (
        <div className="p-4 text-center text-gray-500">Loading…</div>
      ) : (
        <AdminFlagsClient grouped={grouped} statusOptions={STATUS_OPTIONS} statusCounts={statusCounts} activeStatus={statusFilter} />
      )}
    </main>
  );
} 