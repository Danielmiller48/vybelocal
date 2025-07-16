"use client";

import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { createSupabaseBrowser } from "@/utils/supabase/client";
import { format, subDays, startOfDay } from "date-fns";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const supabase = createSupabaseBrowser();

export default function RevenuePage() {
  const [dataSets, setDataSets] = useState({ days: null, weeks: null, months: null, lifetime: null });
  const [stats, setStats] = useState({ days: null, weeks: null, months: null, lifetime: null });
  const [period, setPeriod] = useState("days");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aborted = false;
    async function fetchData() {
      const since = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("ledger")
        .select("vybe_fee_cents,stripe_fee_cents,net_cents,created_at")
        .gte("created_at", `${since} 00:00:00`);

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      // helpers
      const push = (map, key, vybe, stripe) => {
        if (!map[key]) map[key] = { vybe: 0, stripe: 0, total: 0 };
        map[key].vybe += vybe;
        map[key].stripe += stripe;
        map[key].total += vybe + stripe;
      };

      const dayMap = {}, weekMap = {}, monthMap = {};
      for (const row of data) {
        const d = new Date(row.created_at);
        const dayKey = format(startOfDay(d), "yyyy-MM-dd");
        const weekKey = format(d, "yyyy-'W'II"); // ISO week
        const monthKey = format(d, "yyyy-MM");
        push(dayMap, dayKey, row.vybe_fee_cents, row.stripe_fee_cents);
        push(weekMap, weekKey, row.vybe_fee_cents, row.stripe_fee_cents);
        push(monthMap, monthKey, row.vybe_fee_cents, row.stripe_fee_cents);
      }

      const build = (map, slice = null, labelFmt = (k) => k) => {
        const arr = Object.entries(map).sort((a, b) => new Date(a[0]) - new Date(b[0]));
        const sliced = slice ? arr.slice(-slice) : arr;
        return {
          labels: sliced.map(([k]) => labelFmt(k)),
          datasets: [
            {
              label: "Stripe Fees ($)",
              data: sliced.map(([, v]) => (v.stripe / 100).toFixed(2)),
              borderColor: "#EF4444",
              backgroundColor: "#EF4444",
              tension: 0.3,
            },
            {
              label: "Vybe Fee ($)",
              data: sliced.map(([, v]) => (v.vybe / 100).toFixed(2)),
              borderColor: "#4F46E5",
              backgroundColor: "#4F46E5",
              tension: 0.3,
            },
            {
              label: "Total ($)",
              data: sliced.map(([, v]) => (v.total / 100).toFixed(2)),
              borderColor: "#10B981",
              backgroundColor: "#10B981",
              tension: 0.3,
            },
          ],
        };
      };

      const calcStats = (arr) => {
        const sums = arr.reduce(
          (acc, [, v]) => {
            acc.vybe += v.vybe;
            acc.stripe += v.stripe;
            acc.total += v.total;
            acc.count += 1;
            return acc;
          },
          { vybe: 0, stripe: 0, total: 0, count: 0 }
        );
        return {
          transactions: sums.count,
          vybe: (sums.vybe / 100).toFixed(2),
          stripe: (sums.stripe / 100).toFixed(2),
          total: (sums.total / 100).toFixed(2),
          net: ((sums.vybe) / 100).toFixed(2),
        };
      };

      const statsDays = calcStats(Object.entries(dayMap).slice(-15));
      const statsWeeks = calcStats(Object.entries(weekMap).slice(-15));
      const statsMonths= calcStats(Object.entries(monthMap).slice(-15));
      const statsLife  = calcStats(Object.entries(monthMap));

      setDataSets({
        days: build(dayMap, 15, (k) => k.substring(5)),
        weeks: build(weekMap, 15),
        months: build(monthMap, 15),
        lifetime: build(monthMap, null),
      });

      setStats({ days: statsDays, weeks: statsWeeks, months: statsMonths, lifetime: statsLife });
      if (!aborted) setLoading(false);
    }
    fetchData();
    return () => {
      aborted = true;
    };
  }, []);

  if (loading) return <p className="p-4">Loading revenue…</p>;

  return (
    <div className="p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Revenue Dashboard</h1>
      <div className="mb-4 space-x-2">
        {[
          { key: "days", label: "15 Days" },
          { key: "weeks", label: "15 Weeks" },
          { key: "months", label: "15 Months" },
          { key: "lifetime", label: "Lifetime" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPeriod(tab.key)}
            className={`px-3 py-1 rounded ${
              period === tab.key ? "bg-indigo-600 text-white" : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {dataSets[period] && (
        <div className="bg-white rounded-xl shadow p-4">
          <Line
            data={dataSets[period]}
            options={{
              responsive: true,
              plugins: { legend: { position: "bottom" } },
              scales: {
                y: { beginAtZero: true, title: { display: true, text: "Revenue (USD)" } },
              },
            }}
          />
        </div>
      )}

      {/* Metrics Table */}
      {stats[period] && (
        <div className="mt-6 bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold mb-2">Key Metrics</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-1">Transactions</td><td className="py-1 text-right">{stats[period].transactions}</td></tr>
              <tr className="border-b"><td className="py-1">Total Collected</td><td className="py-1 text-right">${stats[period].total}</td></tr>
              <tr className="border-b"><td className="py-1">Stripe Fees</td><td className="py-1 text-right">${stats[period].stripe}</td></tr>
              <tr className="border-b"><td className="py-1">Vybe Fees (Revenue)</td><td className="py-1 text-right">${stats[period].vybe}</td></tr>
              <tr><td className="py-1 font-medium">Net Revenue</td><td className="py-1 text-right font-medium">${stats[period].net}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 