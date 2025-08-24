"use client";

/****************************************************************
 * WHAT THIS SCRIPT DOES                                        *
 * DayDrawer.jsx                                                *
 * ------------------------------------------------------------ *
 * Slide‑over drawer that appears when the user taps a day in   *
 * VibeCalendar / MobileAgenda. Lists the day's events using    *
 * EventCard + inline RSVPButton. Closes on backdrop click or   *
 * Escape key.                                                  *
 ****************************************************************/

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import EventCard from "@/components/event/EventCard";
import { X } from "lucide-react";

export default function DayDrawer({ open, date, events, onClose }) {
  // Esc‑key handler
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, onClose]);

  // Render
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            className="fixed right-0 top-0 h-full w-[90vw] max-w-sm bg-slate-900 z-50 shadow-xl overflow-y-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100">
                {date?.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded hover:bg-slate-800 focus:outline-none"
              >
                <X className="h-5 w-5 text-slate-300" />
              </button>
            </header>

            {/* Event list */}
            <div className="p-4 space-y-4">
              {events.length === 0 ? (
                <p className="text-slate-400 text-sm">No Vybes on this day.</p>
              ) : (
                events.map((ev) => <EventCard key={ev.id} event={ev} inline />)
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
