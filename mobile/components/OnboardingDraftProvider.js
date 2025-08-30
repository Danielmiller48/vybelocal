import React from 'react';

const OnboardingDraftContext = React.createContext(null);

export function OnboardingDraftProvider({ children }) {
  const [draft, setDraft] = React.useState({
    bizType: 'sp',
    spMcc: '7922',
    website: '',
    supportEmail: '',
    supportPhone: '',
    principal: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postal_code: '',
    },
    est: {
      avg_ticket_usd: 35,
      monthly_gross_usd: 2500,
      monthly_txn: 50,
      max_ticket_usd: 200,
      b2b_pct: 20,
      fulfillment_days: 0,
    },
  });

  const updateDraft = React.useCallback((partial) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = React.useMemo(() => ({ draft, updateDraft }), [draft, updateDraft]);
  return (
    <OnboardingDraftContext.Provider value={value}>
      {children}
    </OnboardingDraftContext.Provider>
  );
}

export function useOnboardingDraft() {
  const ctx = React.useContext(OnboardingDraftContext);
  if (!ctx) throw new Error('useOnboardingDraft must be used within OnboardingDraftProvider');
  return ctx;
}


