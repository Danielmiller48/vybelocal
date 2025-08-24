"use client";

// components/HostSidebar.jsx – lightweight sidebar for the Host area
// • Highlights the active link
// • Uses Tailwind for styling so no extra CSS needed

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export default function HostSidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/host",      label: "Upcoming Events" },       // host dashboard
    { href: "/host/new",  label: "Create Event" }, // HostNewForm page
    { href: "/host/history", label: "Past Events" },
  ];

  return (
    <aside className="w-48 shrink-0 bg-gray-800 text-gray-100 flex flex-col p-4">
      <h2 className="mb-4 text-lg font-semibold tracking-wide">Host Tools</h2>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={clsx(
            "rounded-md px-3 py-2 mb-1 hover:bg-gray-700 transition-colors",
            pathname === href && "bg-gray-700 font-semibold"
          )}
        >
          {label}
        </Link>
      ))}
    </aside>
  );
}
