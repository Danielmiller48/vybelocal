export default function VibePage({ params }) {
  const { vibe } = params;
  return (
    <div className="min-h-screen p-8">
      <h2>🎉 {vibe.charAt(0).toUpperCase() + vibe.slice(1)} Vybes (Listing)</h2>
      {/* Event cards for {vibe} */}
    </div>
  );
}