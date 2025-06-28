// app/admin/metrics/page.jsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer} from "@/utils/supabase/server";
import VibeTabs from "@/components/VibeTabs";

export const dynamic = "force-dynamic";

const fmt = (n) => (n ?? 0).toLocaleString("en-US");

export default async function MetricsPage(props) {
  /* ---------- vibe from searchParams (post-await) ---------- */
  const sp   = await props.searchParams;
  let  vibe  = "all";

  if (sp) {
    if (typeof sp.get === "function") {
      vibe = (sp.get("vibe") || "all").toLowerCase();
    } else if (typeof sp === "object") {
      vibe = String(sp["vibe"] ?? "all").toLowerCase();
    }
  }

  const isAll = vibe === "all";
  /* --------------------------------------------------------- */

  const sb = await createSupabaseServer();

  /* 1️⃣ 14-day daily actions */
  const dailyTable = isAll
    ? "v_admin_daily_actions_totals"
    : "v_admin_daily_actions_by_vibe";

  let dailyQ = sb.from(dailyTable).select("*").limit(14);
  if (!isAll) dailyQ.eq("vibe", vibe);
  const { data: daily } = await dailyQ;
  if (!daily) return notFound();

  /* 2️⃣ Top upcoming (category-aware) */
  let topQ = sb.from("v_admin_upcoming").select("*");
  if (!isAll) topQ = topQ.eq("vibe", vibe).limit(5);
  const { data: topEvents } = await topQ;

  /* 3️⃣ Median RSVPs */
  const { data: medRows } = await sb.rpc("median_rsvps_by_vibe", {
    p_vibe: isAll ? null : vibe,
  });
  const median = medRows?.[0]?.median ?? 0;

  /* KPI cards */
  const today = daily[0] ?? { approvals: 0, rejections: 0, rsvps: 0 };
  const cards = [
    { label: "Approvals today",      val: today.approvals },
    { label: "Rejections today",     val: today.rejections },
    { label: "RSVPs today",          val: today.rsvps },
    { label: "Median RSVPs / event", val: median },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Metrics Dashboard</h1>

      <VibeTabs /> {/* same tabs drive category filter */}

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="p-4 rounded-lg bg-white shadow">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className="text-2xl font-semibold">{fmt(c.val)}</p>
          </div>
        ))}
      </div>

      {/* Daily table */}
      <section>
        <h2 className="font-semibold mb-2">Daily Actions (last 14 days)</h2>
        <table className="w-full text-sm bg-white shadow rounded">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Day</th>
              {!isAll && <th className="p-2 text-left">Vibe</th>}
              <th className="p-2 text-right">Approvals</th>
              <th className="p-2 text-right">Rejections</th>
              <th className="p-2 text-right">RSVPs</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={`${d.day}-${d.vibe ?? "all"}`}>
                <td className="p-2">{d.day}</td>
                {!isAll && <td className="p-2 capitalize">{d.vibe}</td>}
                <td className="p-2 text-right">{fmt(d.approvals)}</td>
                <td className="p-2 text-right">{fmt(d.rejections)}</td>
                <td className="p-2 text-right">{fmt(d.rsvps)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Top upcoming — category-specific */}
      <section>
        <h2 className="font-semibold mb-2 capitalize">
          Top Upcoming Events — {isAll ? "All Vibes" : vibe}
        </h2>
        <ul className="space-y-2">
          {topEvents?.map((e) => (
            <li
              key={e.id}
              className="p-3 bg-white shadow rounded flex justify-between"
            >
              <Link
                href={`/admin/dashboard/${e.id}`}
                className="text-indigo-600 hover:underline"
              >
                {e.title}
              </Link>
              <span>{fmt(e.rsvp_count)} RSVPs</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
