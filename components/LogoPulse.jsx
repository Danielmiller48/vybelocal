"use client";

import Image from "next/image";

export default function LogoPulse() {
  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <Image
        src="/public/vybelogo.jpg"
        alt="VybeLocal Neon Logo"
        width={400}   // adjust to your actual logo width
        height={100}  // adjust to your actual logo height
        className="animate-pulse-beat drop-shadow-white-glow"
      />
    </div>
  );
}