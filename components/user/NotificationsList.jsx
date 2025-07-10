"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/utils/supabase/client";

export default function NotificationsList({ userId }) {
  const supabase = createSupabaseBrowser();
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error) setItems(data);
    setLoading(false);
  }

  useEffect(() => { if (userId) load(); }, [userId]);

  async function dismiss(id) {
    await supabase.from('notifications').update({ is_dismissed: true }).eq('id', id);
    setItems(items => items.map(n => n.id === id ? { ...n, is_dismissed: true } : n));
  }

  if (loading) return <p className="p-6 text-gray-500">Loading…</p>;
  if (!items || items.length === 0) return <p className="p-6">No notifications.</p>;

  return (
    <main className="p-4 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <ul className="divide-y">
        {items.map(n => (
          <li key={n.id} className={`p-4 ${n.is_dismissed ? 'opacity-60' : ''}`}>
            <div className="flex justify-between items-start gap-4">
              <div>
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.is_dismissed && (
                <button onClick={() => dismiss(n.id)} className="text-xs text-blue-600 underline">Dismiss</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
} 