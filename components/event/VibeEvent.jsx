import React from "react";
import clsx from "clsx";

/**
 * Single‑event renderer for react‑big‑calendar.
 * Displays a compact neon‑outlined pill whose colour/glow derives from the event.vibe
 * property and RSVP state. If the user hasn’t RSVP’d, we fall back to a grey style.
 *
 * Expected event shape (additional fields are ignored):
 * {
 *   id: string | number,
 *   title: string,
 *   start: Date,
 *   end: Date,
 *   vibe: "chill" | "hype" | "creative" | "active",
 *   rsvpd: boolean
 * }
 */

const styleMap = {
  chill:    { ring: "ring-cyan-400",    glow: "shadow-cyanGlow",    text: "text-cyan-100"   },
  hype:     { ring: "ring-yellow-400",  glow: "shadow-yellowGlow",  text: "text-yellow-100" },
  creative: { ring: "ring-violet-400",  glow: "shadow-violetGlow",  text: "text-violet-100" },
  active:   { ring: "ring-green-400",   glow: "shadow-greenGlow",   text: "text-green-100"  },
};

export default function VibeEvent({ event }) {
  const vibeKey = (event?.vibe || "").toLowerCase();
  const vibe = styleMap[vibeKey];

  /* Default greyscale style when not RSVP’d or vibe missing */
  const ringClass = event?.rsvpd && vibe ? vibe.ring : "ring-slate-600";
  const textClass = event?.rsvpd && vibe ? vibe.text : "text-slate-400";
  const glowClass = event?.rsvpd && vibe ? vibe.glow : ""; // glow only when RSVP’d

  return (
    <div
      className={clsx(
        "flex items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-medium truncate",
        "ring-2", ringClass, glowClass, textClass,
      )}
      /* Let react‑big‑calendar handle onSelect etc. */
    >
      {event?.title || "Untitled"}
    </div>
  );
}
