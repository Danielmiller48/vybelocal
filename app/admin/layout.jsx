import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabase as createSupabase } from "@/utils/supabase/server";
import AdminSidebar from "@/components/AdminSidebar";   // ★ default import

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  /* auth gate */
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  /* admin-flag check */
  const sb = await createSupabase();
  const { data: profile } = await sb
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profile?.is_admin) redirect("/");

  /* page */
  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
