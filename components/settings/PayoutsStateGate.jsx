// components/settings/PayoutsStateGate.jsx
// -----------------------------------------------------------------------------
// Renders payout/earnings state guidance based on KYB status from waitlist API.
// Unlocks management UI when tilled_status is 'active'.
// -----------------------------------------------------------------------------

export default function PayoutsStateGate({ data }) {
  const status = data?.tilled_status || null;
  const needsConnected = data?.needs_connected_account === true;
  const needsOnboarding = data?.needs_onboarding === true;
  const onboardingUrl = data?.onboarding_application_url || null;
  const required = Array.isArray(data?.required) ? data.required : null;
  const bankStatus = data?.bank_verification_status || null;

  function Section({ title, children }) {
    return (
      <section className="rounded-lg border border-gray-200 p-4 space-y-2 bg-white">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="text-sm text-gray-700 space-y-2">{children}</div>
      </section>
    );
  }

  if (!data) {
    return (
      <Section title="Payouts">
        <p>Checking your payout setup…</p>
      </Section>
    );
  }

  // No connected account yet
  if (data?.status === 'no_account' || needsConnected) {
    return (
      <Section title="Set up payouts">
        <p>You don’t have a connected payouts account yet.</p>
        <ul className="list-disc pl-5">
          <li>Start onboarding to verify your business details.</li>
          <li>Once verified, you’ll be able to receive earnings automatically.</li>
        </ul>
        {onboardingUrl ? (
          <a href={onboardingUrl} className="inline-block mt-2 px-3 py-2 rounded-md bg-black text-white">
            Continue onboarding
          </a>
        ) : null}
      </Section>
    );
  }

  // Active → unlock management
  if (status === 'active') {
    return (
      <Section title="Payouts">
        <p className="text-green-700">Your account is verified and payouts are enabled.</p>
        <div className="rounded-md border border-gray-200 p-3">
          <p className="font-medium">Payouts management</p>
          <p className="text-gray-600 text-sm">Manage earnings and deposits here. (Coming soon)</p>
        </div>
      </Section>
    );
  }

  // In review
  if (status === 'in_review') {
    return (
      <Section title="Verification in review">
        <p>Your information was submitted and is currently under review. This usually takes up to 1–2 business days.</p>
        <p>You’ll be notified if anything else is needed.</p>
        {onboardingUrl ? (
          <a href={onboardingUrl} className="inline-block mt-2 px-3 py-2 rounded-md bg-black text-white">
            View application
          </a>
        ) : null}
      </Section>
    );
  }

  // Action required
  if (status === 'action_required') {
    return (
      <Section title="Action required to enable payouts">
        <p>We need a bit more information to verify your account.</p>
        {required && required.length > 0 ? (
          <div>
            <p className="font-medium">Requested items:</p>
            <ul className="list-disc pl-5">
              {required.map((item, idx) => (
                <li key={idx}>{String(item)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {bankStatus ? (
          <p>Bank verification status: <span className="font-medium">{String(bankStatus)}</span></p>
        ) : null}
        {onboardingUrl ? (
          <a href={onboardingUrl} className="inline-block mt-2 px-3 py-2 rounded-md bg-black text-white">
            Continue onboarding
          </a>
        ) : null}
      </Section>
    );
  }

  // Rejected
  if (status === 'rejected') {
    return (
      <Section title="Verification unsuccessful">
        <p>Your application was not approved.</p>
        <ul className="list-disc pl-5">
          <li>Double‑check your business information and documents.</li>
          <li>Re‑submit with corrected details or contact support if you believe this is an error.</li>
        </ul>
        {onboardingUrl ? (
          <a href={onboardingUrl} className="inline-block mt-2 px-3 py-2 rounded-md bg-black text-white">
            Review application
          </a>
        ) : null}
      </Section>
    );
  }

  // Started or unknown
  return (
    <Section title="Finish setting up payouts">
      <p>Complete onboarding to enable payouts.</p>
      {bankStatus ? (
        <p>Bank verification status: <span className="font-medium">{String(bankStatus)}</span></p>
      ) : null}
      {onboardingUrl ? (
        <a href={onboardingUrl} className="inline-block mt-2 px-3 py-2 rounded-md bg-black text-white">
          Continue onboarding
        </a>
      ) : null}
    </Section>
  );
}


