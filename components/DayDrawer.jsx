"use client";

// ────────────────────────────────────────────────────────────
// WHAT THIS SCRIPT DOES                                              
// DayDrawer.jsx                                                      
// ------------------------------------------------------------------
// • Slide‑over drawer that appears on the right when a user taps a   
//   calendar day in VibeCalendar.                                    
// • Shows the selected date as a heading and lists every matching    
//   event using the universal <EventCard>.                           
// • Inline RSVP support via the existing <RSVPButton> inside each    
//   EventCard.                                                       
// • Dismissable by clicking the X, tapping the backdrop, or pressing 
//   Esc.                                                             
// • Animated with framer‑motion for a smooth slide‑in/out.           
// • Intended for both desktop and mobile—swipe gestures could be     
//   added later if desired.                                          
// ────────────────────────────────────────────────────────────

import React, { useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import EventCard from "./EventCard";
import { X } from "lucide-react";
import clsx from "clsx";

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function DayDrawer({ open, date, events, onClose }) {
  // Close on Esc key
  const escListener = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) window.addEventListener("keydown", escListener);
    return () => window.removeEventListener("keydown", escListener);
  }, [open, escListener]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            className="fixed right-0 top-0 h-full w-full sm:w-96 bg-slate-900 z-50 shadow-xl flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
          >
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-slate-100">
                {formatDate(date)}
              </h3>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200"
                aria-label="Close day drawer"
              >
                <X size={20} />
              </button>
            </header>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {events.length === 0 ? (
                <p className="text-sm text-slate-400 text-center">
                  No events for this day.
                </p>
              ) : (
                events.map((evt) => <EventCard key={evt.id} event={evt} />)
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
