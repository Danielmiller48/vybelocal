"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { createSupabaseBrowser } from "@/utils/supabase/client";

export default function BanModalClient() {
  const [showBan, setShowBan] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const supabase = createSupabaseBrowser();
  const pathname = usePathname();

  // Check ban status
  async function checkBanStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setShowBan(false);
        setIsChecking(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_permanently_banned")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.is_permanently_banned) {
        setShowBan(true);
      } else {
        setShowBan(false);
      }
    } catch (error) {
      console.error("Ban check error:", error);
      setShowBan(false);
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

  // Don't show anything while checking or on login/register
  if (isChecking || pathname === "/login" || pathname === "/register") {
    return null;
  }

  // Don't show modal if not banned
  if (!showBan) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false }); // NextAuth
      const supabase = createSupabaseBrowser();
      await supabase.auth.signOut(); // Supabase
      // Clear cookies manually (for good measure)
      document.cookie = "banned=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "sb-tzwksdoffzoerzcfsucm-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "sb-tzwksdoffzoerzcfsucm-auth-token.0=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "sb-tzwksdoffzoerzcfsucm-auth-token.1=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      // Force reload to homepage
      window.location.href = "/";
    } catch (error) {
      console.error("Sign out error:", error);
      window.location.href = "/";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-xl text-center">
        <h1 className="text-2xl font-extrabold mb-4 leading-tight">You didn't just break a rule. You broke the reason we built this at all.</h1>
        <h2 className="text-xl font-bold mb-6 text-red-700">You have been removed from the VybeLocal community</h2>
        <p className="mb-4 text-gray-700 text-base">
          Whether you came here to promote your OnlyFans on every RSVP, drop a scam link, "network" through thirst traps, or slide into DMs like it's your side hustle—
          <span className="block text-2xl font-bold italic my-2">nah.</span>
          We built this for community, not clout-chasing, click-farming, or creepy predatory cycles.
        </p>
        <p className="mb-4 text-gray-700 text-base">
          This isn't a chat protected by a screen. This isn't your growth funnel.<br />
          This is where real people connect with intention—and you showed up with a conversion strategy, a bad Vibe, or said something that crossed the line.
        </p>
        <p className="mb-4 text-gray-700 text-base">
          If you think we got it wrong—or you've experienced a full personality reboot—you can send <b>one</b> message to <a href="mailto:support@vybelocal.com" className="underline text-blue-700">support@vybelocal.com</a>.
        </p>
        <p className="mb-4 text-gray-700 text-base">
          One appeal. No alt accounts. No <b>"it was just a joke."</b><br />
          Respect is the baseline. You came in below it.
        </p>
        <p className="mb-6 text-gray-800 text-lg font-bold">
          Good luck out there—<br />
          …and get some help.
        </p>
        <button 
          className="px-6 py-2 rounded bg-red-600 text-white font-semibold text-lg hover:bg-red-700 transition-colors" 
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </div>
    </div>
  );
} 