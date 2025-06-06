/** @type {import('tailwindcss').Config} */
module.exports = {
  // 1. Tell Tailwind where to look for class names
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
 theme: {
    extend: {
      keyframes: {
        pulseBeat: {
          "0%, 100%": { opacity: "0.9", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
      },
      animation: {
        "pulse-beat": "pulseBeat 1s ease-in-out infinite",
      },
      dropShadow: {
        "white-glow": "0 0 15px rgba(255,255,255,0.8)",
      },
    
      colors: {
        vibe: {
          chill: "#4F46E5",      // indigo-700
          hype: "#DC2626",       // red-600
          creative: "#9333EA",   // purple-600
          active: "#059669",     // emerald-600
        },
      },
      // 3. Center the container by default, with sensible padding
      container: {
        center: true,
        padding: {
          DEFAULT: "1rem",
          sm: "2rem",
          lg: "4rem",
          xl: "6rem",
        },
      },
      // 4. Add any custom spacing, font sizes, or shadows here
      spacing: {
        "128": "32rem",
        "144": "36rem",
      },
      fontSize: {
        "7xl": "5rem",
        "8xl": "6rem",
      },
      boxShadow: {
        "outline-md": "0 0 0 3px rgba(79, 70, 229, 0.5)", // indigo focus ring
      },
    },
  },
  plugins: [
    // 5. Optional plugins to improve forms, typography, etc.
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    // require("@tailwindcss/aspect-ratio"), // uncomment if you use aspect-ratio
  ],
};