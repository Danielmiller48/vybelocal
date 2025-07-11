"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowser } from "@/utils/supabase/client";

export default function SoftBanModalClient() {
  const [show, setShow] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [remaining, setRemaining] = useState(null);
  const [userId, setUserId] = useState(null); // <-- add this
  const supabase = createSupabaseBrowser();
  const pathname = usePathname();

  function msUntil(dateStr) {
    const t = new Date(dateStr).getTime() - Date.now();
    return Math.max(t, 0);
  }

  async function checkBanStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setShow(false);
        setIsChecking(false);
        setUserId(null); // clear userId
        return;
      }

      setUserId(user.id); // <-- set userId here
      const { data: profile } = await supabase
        .from("profiles")
        .select("soft_ban_expires_at, warning_issued")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.soft_ban_expires_at) {
        const now = new Date();
        const expiry = new Date(profile.soft_ban_expires_at);
        const isActive = expiry > now;
        const readKey = `softBanRead-${user.id}`;
        const acknowledged = typeof window !== 'undefined' && localStorage.getItem(readKey) === '1';

        if (isActive || !acknowledged) {
          setShow(true);
          setRemaining(msUntil(profile.soft_ban_expires_at));
        } else {
          setShow(false);
        }
      } else {
        setShow(false);
      }
    } catch (error) {
      console.error("Soft ban check error:", error);
      setShow(false);
    } finally {
      setIsChecking(false);
    }
  }

  // Check on mount and route changes
  useEffect(() => {
    checkBanStatus();
  }, [pathname]);

  // Check on auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkBanStatus();
    });
    return () => subscription?.unsubscribe();
  }, [supabase]);

  // Countdown timer
  useEffect(() => {
    if (!show) return;
    const id = setInterval(() => {
      setRemaining(prev => (prev ? Math.max(prev - 1000, 0) : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [show]);

  // Don't show anything while checking or on login/register
  if (isChecking || pathname === "/login" || pathname === "/register") {
    return null;
  }

  // Don't show modal if not suspended
  if (!show) {
    return null;
  }

  const strike = 2; // Strike 2 of 3
  const hours = Math.floor((remaining || 0) / 3600000);
  const minutes = Math.floor(((remaining || 0) % 3600000) / 60000);
  const timeLeft = `${hours}h ${minutes}m`;
  const canDismiss = remaining === 0;

  const handleDismiss = () => {
    if (!canDismiss) return;
    if (userId) {
      const readKey = `softBanRead-${userId}`;
      localStorage.setItem(readKey, '1');
    }
    window.location.reload();
  };

  // Removed body class manipulation for simplicity

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-xl w-full shadow-xl text-center space-y-4">
        <h2 className="text-xl font-bold text-orange-700">You've been suspended from VybeLocal for 24 hours.</h2>
        <p className="text-gray-700">This isn't a full ban—but it's a serious warning.<br/>You crossed a line, or brought energy into this space that doesn't belong here.</p>
        <p className="text-gray-700">Maybe you didn't read the guidelines. Maybe you thought no one would care.<br/>But this community does care—and you're on your last shot.</p>
        <p className="text-gray-700">We built VybeLocal to be a safe, respectful space for real connection—<br/>not a free-for-all, not a pickup zone, and not a platform for keyboard cowards.</p>
        <p className="text-gray-700 font-semibold">Strike {strike} of 3</p>
        <p className="text-gray-600">Time remaining: {timeLeft}</p>
        <button
          disabled={!canDismiss}
          onClick={handleDismiss}
          className={`px-5 py-2 rounded font-semibold ${canDismiss ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-400 text-gray-200 cursor-not-allowed'}`}
        >
          {canDismiss ? 'Mark as Read & Continue' : 'Come back later'}
        </button>
      </div>
    </div>
  );
} 