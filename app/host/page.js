// app/host/page.jsx
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function HostLanding() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <h1 className="text-3xl font-bold">Community Guidelines</h1>

      <Guidelines />

      <div className="flex gap-4">
        <Link href="/host/tools" className="btn-primary">
          Host Dashboard
        </Link>
        <Link href="/host/new" className="btn-secondary">
          Host a Vybe
        </Link>
      </div>
    </main>
  );
}

/* --- stub; swap for real DNA text later --- */
function Guidelines() {
  return (
    <section className="prose prose-sm sm:prose">
      <p>Welcome to VybeLocal! Before hosting an event, agree to these pillars:</p>
      <ol>
        <li>No ranking or popularity contests—every Vybe is equal.</li>
        <li>Ensure accessibility for all guests.</li>
        <li>Zero tolerance for harassment or hate speech.</li>
        <li>Follow local laws & permits.</li>
        <li>Respect privacy—share attendee data only for event ops.</li>
      </ol>
    </section>
  );
}
