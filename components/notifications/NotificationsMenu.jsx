// components/notifications/NotificationsMenu.jsx
"use client";
import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { createSupabaseBrowser } from '@/utils/supabase/client';

export default function NotificationsMenu() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const sb = createSupabaseBrowser();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await sb
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      setItems(data || []);
    })();
  }, [userId]);

  async function clearNotif(id) {
    await sb.from('notifications').delete().eq('id', id);
    setItems(prev => prev.filter(n => n.id !== id));
  }

  async function clearAll() {
    if (!items.length) return;
    await sb.from('notifications').delete().eq('user_id', userId);
    setItems([]);
  }

  const unread = items.filter(n => !n.is_dismissed).length;

  return (
    <div className="relative">
      <button className="p-2 rounded hover:bg-gray-100 relative" onClick={() => setOpen(!open)}>
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] rounded-full px-1 leading-none">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded shadow-lg z-50 text-sm divide-y">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="font-medium">Notifications</span>
            {items.length > 0 && (
              <button className="text-xs text-red-600 underline" onClick={clearAll}>
                Clear All
              </button>
            )}
          </div>
          {items.length === 0 && <p className="p-4 text-gray-500">No notifications</p>}
          {items.map(n => (
            <div key={n.id} className="px-4 py-2 flex gap-2">
              <div className="flex-1">
                <p className="font-medium text-gray-800">{n.title}</p>
                <p className="text-gray-700 text-xs whitespace-pre-wrap">{n.message}</p>
                <p className="text-gray-400 text-[10px] mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              <button className="text-xs text-red-500 self-start" onClick={() => clearNotif(n.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 