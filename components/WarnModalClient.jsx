// components/WarnModalClient.jsx – safe variant
"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSupabase } from "@/app/ClientProviders";

export default function WarnModalClient() {
  const pathname = usePathname();
  const { supabase, session: sbSession } = useSupabase();
  const uid = sbSession?.user?.id;              // available only after SupabaseBridge syncs
  const [show, setShow] = useState(false);

  /* 1️⃣ fetch flag once session is ready */
  useEffect(() => {
    if (!uid) return;                           // still syncing or logged-out
    if (pathname === "/login" || pathname === "/register") return;

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("warning_issued")
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        console.error("WarnModal profile fetch", error.message);
        return;
      }

      const ack = localStorage.getItem(`warnRead-${uid}`) === "1";
      setShow(Boolean(data?.warning_issued && !ack));
    })();
  }, [uid, pathname, supabase]);

  if (!uid || !show) return null;

  function acknowledge() {
    localStorage.setItem(`warnRead-${uid}`, "1");
    setShow(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md text-center space-y-4">
        <h2 className="text-lg font-bold text-yellow-700">Heads up — Warning issued</h2>
        <p className="text-gray-700">This is your first strike. Please review the community guidelines to avoid suspension.</p>
        <button onClick={acknowledge} className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold">
          Got it
        </button>
      </div>
    </div>
  );
}
