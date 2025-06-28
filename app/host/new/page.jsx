import Link from "next/link";
import HostNewForm from "@/components/HostNewForm";

// NOTE: `dynamic` is a **string directive** for Next 15—not a function.
// You don’t need `async` here unless this component is doing server work.
export const dynamic = "force-dynamic";

export default function HostNewPage() {
  return (
    <div className="space-y-6">
      <Link href="/host" className="text-indigo-600 hover:underline">
        ← Back to dashboard
      </Link>

      <h1 className="text-2xl font-bold">Submit a New Event</h1>

      {/* HostNewForm handles its own POST → /api/events */}
      <HostNewForm />

      <p className="text-sm text-gray-500">
        All new events go through moderator approval before they appear publicly.
      </p>
    </div>
  );
}