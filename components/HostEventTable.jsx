// components/HostEventTable.jsx
import Link from "next/link";
const fmt = (n) => (n ?? 0).toLocaleString("en-US");

export default function HostEventTable({ events }) {
  if (!events.length)
    return <p className="italic text-gray-500">No events yet.</p>;

  return (
    <section>
      <h2 className="font-semibold mb-2">Your Events</h2>
      <table className="w-full text-sm bg-white shadow rounded">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Title</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-right">RSVPs</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td className="p-2">{e.title}</td>
              <td className="p-2 capitalize">{e.status}</td>
              <td className="p-2 text-right">{fmt(e.rsvp_count)}</td>
              <td className="p-2 text-right">
                <Link
                  href={`/host/events/${e.id}`}
                  className="text-indigo-600 hover:underline"
                >
                  View / Edit →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
