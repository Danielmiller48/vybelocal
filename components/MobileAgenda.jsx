"use client";

/****************************************************************
 * MobileAgenda.jsx                                             *
 * ------------------------------------------------------------ *
 * Responsive, finger‑friendly agenda list for phones (< md).   *
 * Groups events by local date, shows collapsible day rows.     *
 * Re‑uses EventCard for each event and calls onSelectEvent      *
 * when tapped. Smooth expand/collapse via framer‑motion.       *
 ****************************************************************/

import React, { useState, useMemo, useRef, useEffect } from "react";
import { toZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { ChevronDown, ChevronRight } from "lucide-react";

import EventCard from "./EventCard";

const TZ = "America/Denver";

/**
 * @param {{
 *   events: Array<{ id:string|number, title:string, start:Date|string, end:Date|string, vibe:string, rsvpd?:boolean }>,
 *   onSelectEvent?: (event) => void,
 * }} props
 */
export default function MobileAgenda({ events = [], onSelectEvent }) {
  // --- group events by YYYY-MM-DD in MTN time ------------------
  const grouped = useMemo(() => {
    const map = new Map();
    events.forEach((ev) => {
      const start = toZonedTime(new Date(ev.start), TZ);
      const key = format(start, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ ...ev, localStart: start });
    });
    // sort events inside each day by time
    map.forEach((arr) => arr.sort((a, b) => a.localStart - b.localStart));

    // return sorted [{ key, dateObj, items }]
    return Array.from(map.entries())
      .map(([k, items]) => ({ key: k, date: items[0].localStart, items }))
      .sort((a, b) => a.date - b.date);
  }, [events]);

  // --- expand / collapse state --------------------------------
  const [openKey, setOpenKey] = useState(() => {
    const todayKey = format(toZonedTime(new Date(), TZ), "yyyy-MM-dd");
    return todayKey;
  });

  // --- auto‑scroll to today on mount ---------------------------
  const todayRef = useRef(null);
  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const vibeStripe = (vibe) =>
    clsx(
      "w-1 rounded-l-lg",
      vibe === "chill" && "bg-cyan-400",
      vibe === "hype" && "bg-yellow-400",
      vibe === "creative" && "bg-violet-400",
      vibe === "active" && "bg-green-400"
    );

  return (
    <div className="flex flex-col gap-1 pb-16">
      {grouped.map(({ key, date, items }) => {
        const isOpen = openKey === key;
        const ref = key === format(toZonedTime(new Date(), TZ), "yyyy-MM-dd") ? todayRef : undefined;
        return (
          <div key={key} ref={ref}>
            {/* Day header */}
            <button
              onClick={() => setOpenKey(isOpen ? null : key)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md"
            >
              <span className="font-medium text-sm tracking-wide">
                {format(date, "EEE, MMM d")}
              </span>
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {/* Collapsible events */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden mt-1 pl-6 pr-1"
                >
                  {items.map((ev) => (
                    <div
                      key={ev.id}
                      className="relative mb-3 last:mb-0"
                      onClick={() => onSelectEvent?.(ev)}
                    >
                      <span className={vibeStripe(ev.vibe)} />
                      <EventCard event={ev} compact />
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
