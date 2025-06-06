import Image from "next/image";

export default function HomePage() {
  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <Image
        src="/vybelogo.jpg"              // Make sure your file is at public/vybelogo.png
        alt="VybeLocal Neon Logo"
        width={400}                       // Adjust these to match your logo’s real size
        height={200}
        className="animate-pulse-beat drop-shadow-white-glow"
      />
    </div>
  );
}