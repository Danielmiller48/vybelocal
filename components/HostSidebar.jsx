import Link from "next/link";

export default function HostSidebar() {
  return (
    <aside className="w-52 shrink-0 border-r p-4 space-y-4">
      <h2 className="font-semibold">Host Tools</h2>
      <nav className="space-y-2">
        <Link href="/host"        className="block hover:underline">
          📊 Dashboard
        </Link>
        <Link href="/host/new"    className="block hover:underline">
          ➕ New Event
        </Link>
      </nav>
    </aside>
  );
}
