"use client";
import { Fragment } from "react";
import Link from "next/link";
import { Disclosure } from "@headlessui/react";
import {
  ChevronDown,
  PencilLine,
  Users as UsersIcon,
  Copy as CopyIcon,
  Trash2 as TrashIcon,
} from "lucide-react";

const fmt = (n) => (n ?? 0).toLocaleString("en-US");

/**
 * HostEventAccordion – replaces the table with an accordion tool-set.
 *
 * Each event renders as a Headless UI <Disclosure> so we get:
 *   • Keyboard-accessible expand / collapse (Enter / Space)
 *   • ARIA roles + focus management baked in
 *
 * Inside the panel we surface quick-action buttons:
 *   • Edit (link to event detail page)
 *   • View RSVPs
 *   • Duplicate (placeholder handler)
 *   • Delete (placeholder handler)
 *
 * Tailwind + lucide-react icons keep things lightweight; no extra CSS.
 */
export default function HostEventAccordion({ events = [] }) {
  if (!events.length)
    return <p className="italic text-gray-500">No events yet.</p>;

  return (
    <section className="space-y-2">
      <h2 className="font-semibold text-lg">Your Events</h2>

      {events.map((e) => (
        <Disclosure key={e.id} as="div" className="bg-white rounded shadow">
          {({ open }) => (
            <>
              {/* summary bar */}
              <Disclosure.Button className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/75">
                <div className="flex items-center gap-3 truncate">
                  <span className="font-medium truncate max-w-[12rem] sm:max-w-xs">
                    {e.title}
                  </span>
                  <span
                    className={
                      {
                        draft: "bg-yellow-100 text-yellow-800",
                        live: "bg-green-100 text-green-800",
                        closed: "bg-gray-200 text-gray-700",
                      }[e.status] +
                      " px-2 py-0.5 rounded text-[11px] uppercase tracking-wide"
                    }
                  >
                    {e.status}
                  </span>
                </div>

                <div className="flex items-center gap-6">
                  <span className="text-sm tabular-nums">{fmt(e.rsvp_count)} RSVP</span>
                  <ChevronDown
                    className={`h-5 w-5 transition-transform ${open ? "rotate-180" : "rotate-0"}`}
                  />
                </div>
              </Disclosure.Button>

              {/* detail panel */}
              <Disclosure.Panel className="px-6 py-4 border-t text-sm bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  {/* left: meta info */}
                  <div className="space-y-1 max-w-xl">
                    {e.description && (
                      <p>
                        <span className="font-medium">Description: </span>
                        {e.description}
                      </p>
                    )}
                    {e.location && (
                      <p>
                        <span className="font-medium">Location: </span>
                        {e.location}
                      </p>
                    )}
                    {e.starts_at && (
                      <p>
                        <span className="font-medium">Date: </span>
                        {new Date(e.starts_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* right: tool set */}
                  <div className="flex gap-3 flex-wrap shrink-0">
                    <Link
                      href={`/host/events/${e.id}`}
                      className="btn-icon"
                      title="Edit event"
                    >
                      <PencilLine className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/host/events/${e.id}/attendees`}
                      className="btn-icon"
                      title="View RSVPs"
                    >
                      <UsersIcon className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => console.log("duplicate", e.id)}
                      className="btn-icon"
                      title="Duplicate event"
                    >
                      <CopyIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => console.log("delete", e.id)}
                      className="btn-icon text-red-600 hover:bg-red-50"
                      title="Delete event"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>
      ))}
    </section>
  );
}

/* --------------- tiny utility class --------------- */
// Because Tailwind doesn’t ship a generic “icon button” utility out of the box.
// Add this to your global.css or keep it here for tree-shaking simplicity.
// .btn-icon {
//   @apply inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-200 transition;
// }
