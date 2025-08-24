// components/HostMetricsCards.jsx
const fmt = (n) => (n ?? 0).toLocaleString("en-US");

export default function HostMetricsCards({ totals }) {
  const cards = [
    { label: "Total RSVPs", val: totals.total },
    { label: "RSVPs today", val: totals.today },
    { label: "Canceled RSVPs", val: totals.canceled },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="p-4 rounded-lg bg-white shadow">
          <p className="text-sm text-gray-500">{c.label}</p>
          <p className="text-2xl font-semibold">{fmt(c.val)}</p>
        </div>
      ))}
    </div>
  );
}
