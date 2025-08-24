"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/utils/supabase/client";

export default function NotificationsModalClient() {
  const supabase = createSupabaseBrowser();
  const [notif, setNotif] = useState(null); // single notification
  const [open, setOpen] = useState(false);

  async function fetchNotif() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("id,title,message")
      .eq("user_id", user.id)
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      setNotif(data);
      setOpen(true);
    }
  }

  useEffect(() => {
    fetchNotif(); // on mount
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => fetchNotif());
    return () => subscription?.unsubscribe();
  }, []);

  async function dismiss() {
    if (!notif) return;
    await supabase.from("notifications").update({ is_dismissed: true }).eq("id", notif.id);
    setOpen(false);
  }

  if (!open || !notif) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center space-y-4">
        <h2 className="text-xl font-bold">{notif.title}</h2>
        <p className="text-gray-700 whitespace-pre-wrap">{notif.message}</p>
        <button
          onClick={dismiss}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Got it
        </button>
      </div>
    </div>
  );
} 