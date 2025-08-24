// ── app/user/layout.jsx ──
// Server component that injects the mobile‑first UserSidebar and streams
// any nested /user routes (Discover, Calendar, Profile).

import UserSidebarClient from "@/components/user/UserSidebarClient";
import { createSupabaseServer } from "@/utils/supabase/server";

export const dynamic = "force-dynamic"; // always SSR so auth stays fresh

export default async function UserLayout({ children }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let avatarUrl = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single();
    avatarUrl = profile?.avatar_url ?? null;
  }

  return (
    <div className="sm:flex min-h-screen">
      {/* sidebar (client component) */}
      <UserSidebarClient />

      {/* main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
    </div>
  );
}
