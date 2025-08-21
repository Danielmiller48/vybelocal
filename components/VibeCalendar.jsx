"use client";

/****************************************************************
 * VibeCalendar.jsx                                             *
 * ------------------------------------------------------------ *
 * Responsive calendar wrapper.                                 *
 * ▸ Desktop / tablet ≥ md  → Month grid (react-big-calendar).  *
 * ▸ Mobile < md            → MobileAgenda scroll list.         *
 ****************************************************************/

import React, { useMemo, useState, useEffect } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import clsx from "clsx";

import VibeEvent from "@/components/VibeEvent";
import DayDrawer from "@/components/DayDrawer";
import MobileAgenda from "@/components/MobileAgenda";

import "react-big-calendar/lib/css/react-big-calendar.css";

/* ---------- Constants -------------------------------------- */
const locales = { "en-US": require("date-fns/locale/en-US") };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});
const TZ = "America/Denver";

/* ---------- Helper: viewport check ------------------------- */
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setMobile(e.matches);
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

/* ---------- Component -------------------------------------- */
export default function VibeCalendar({ events, role = "user" }) {
  /* ----- Normalise event dates once ------------------------ */
  const localEvents = useMemo(
    () =>
      events.map((e) => ({
        ...e,
        start: toZonedTime(new Date(e.start), TZ),
        end: toZonedTime(new Date(e.end), TZ),
      })),
    [events]
  );

  /* ----- Filtering state ----------------------------------- */
  const [vibe, setVibe] = useState("all");
  const [status, setStatus] = useState(role === "host" ? "approved" : "mine");
  const isMobile = useIsMobile();

  const filteredEvents = useMemo(() => {
    return localEvents.filter((ev) => {
      /* status/vibe logic */
      if (vibe !== "all" && ev.vibe !== vibe) return false;
      if (role === "user") {
        // already RSVP-filtered upstream
        return true;
      }
      if (role === "host") {
        if (status === "all") return true;
        return ev.status === status;
      }
      // admin role future logic here
      return true;
    });
  }, [localEvents, vibe, status, role]);

  /* ----- Drawer state -------------------------------------- */
  const [drawer, setDrawer] = useState({ open: false, date: null, dayEvents: [] });
  function openDrawer(date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const nextDay = new Date(dayStart);
    nextDay.setDate(dayStart.getDate() + 1);
    setDrawer({
      open: true,
      date: dayStart,
      dayEvents: localEvents.filter((ev) => ev.start >= dayStart && ev.start < nextDay),
    });
  }

  /* ----- Render -------------------------------------------- */
  return (
    <div className="w-full mx-auto text-slate-200">
      {/* Filter chips (simplified for brevity) */}
      <div className="flex gap-2 flex-wrap mb-2">
        {["all", "chill", "hype", "creative", "active"].map((v) => (
          <button
            key={v}
            className={clsx(
              "px-3 py-1 rounded-full text-xs font-medium border",
              vibe === v ? "bg-slate-700 border-slate-400" : "border-slate-600"
            )}
            onClick={() => setVibe(v)}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* View switch */}
      {isMobile ? (
        <MobileAgenda events={filteredEvents} onSelectEvent={(ev) => openDrawer(ev.start)} />
      ) : (
        <div className="mt-4 h-[70vh] md:h-[80vh] w-full">
          <Calendar
            localizer={localizer}
            events={filteredEvents}
            components={{ event: VibeEvent }}
            eventPropGetter={() => ({ className: "text-xs font-medium" })}
            selectable
            onSelectSlot={(slot) => openDrawer(slot.start)}
          />
        </div>
      )}

      {/* DayDrawer */}
      {drawer.open && (
        <DayDrawer
          open={drawer.open}
          date={drawer.date}
          events={drawer.dayEvents}
          onClose={() => setDrawer({ ...drawer, open: false })}
        />
      )}
    </div>
  );
}
