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

import VibeEvent from "@/components/event/VibeEvent";
import DayDrawer from "@/components/event/DayDrawer";
import MobileAgenda from "@/components/event/MobileAgenda";

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

/* ---------- Helper: group events by day ------------------- */
function groupEventsByDay(events) {
  const grouped = {};
  events.forEach(event => {
    const dayKey = format(event.start, 'yyyy-MM-dd');
    if (!grouped[dayKey]) {
      grouped[dayKey] = [];
    }
    grouped[dayKey].push(event);
  });
  return grouped;
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
  const [status, setStatus] = useState(role === "host" ? "approved" : "all");
  const isMobile = useIsMobile();

  const filteredEvents = useMemo(() => {
    return localEvents.filter((ev) => {
      /* status/vibe logic */
      if (vibe !== "all" && ev.vibe !== vibe) return false;
      if (role === "user") {
        // Show all events for users, filtering by vibe only
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

  /* ----- Group events by day for display logic ------------- */
  const eventsByDay = useMemo(() => groupEventsByDay(filteredEvents), [filteredEvents]);

  /* ----- Filter events for calendar display ---------------- */
  const calendarEvents = useMemo(() => {
    const processedEvents = [];
    const processedDays = new Set();

    filteredEvents.forEach(event => {
      const dayKey = format(event.start, 'yyyy-MM-dd');
      const dayEvents = eventsByDay[dayKey] || [];
      
      if (dayEvents.length > 3) {
        // If this day has more than 3 events and we haven't processed it yet
        if (!processedDays.has(dayKey)) {
          processedDays.add(dayKey);
          // Create a placeholder event for the "4+ events" display
          processedEvents.push({
            ...event,
            title: `${dayEvents.length}+ events`,
            isPlaceholder: true,
          });
        }
      } else {
        // Show individual events for days with 3 or fewer events
        processedEvents.push(event);
      }
    });

    return processedEvents;
  }, [filteredEvents, eventsByDay]);

  /* ----- Custom event component for calendar ---------------- */
  const CustomEvent = ({ event }) => {
    if (event.isPlaceholder) {
      // Show "4+ events" message
      return (
        <div className="flex items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-medium truncate bg-slate-700 text-slate-300 ring-2 ring-slate-600">
          {event.title}
        </div>
      );
    } else {
      // Show individual event
      return <VibeEvent event={event} />;
    }
  };

  /* ----- Drawer state -------------------------------------- */
  const [drawer, setDrawer] = useState({ open: false, date: null, dayEvents: [] });
  function openDrawer(date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const nextDay = new Date(dayStart);
    nextDay.setDate(dayStart.getDate() + 1);
    
    // Get all events for this day
    const allDayEvents = localEvents.filter((ev) => ev.start >= dayStart && ev.start < nextDay);
    
    // Apply the current vibe filter to the drawer events
    const filteredDayEvents = allDayEvents.filter((ev) => {
      if (vibe === "all") return true;
      return ev.vibe === vibe;
    });
    
    setDrawer({
      open: true,
      date: dayStart,
      dayEvents: filteredDayEvents,
      currentFilter: vibe,
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
            events={calendarEvents}
            components={{ event: CustomEvent }}
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
          currentFilter={drawer.currentFilter}
        />
      )}
    </div>
  );
}
