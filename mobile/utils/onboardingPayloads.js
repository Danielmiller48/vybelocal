// Centralized builders for KYB payloads (Tilled-style for now; Moov mapping later)
// Keep functions pure; accept primitives/POJOs only so we can reuse from any screen

export function toE164US(input) {
  try {
    const digits = String(input || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (String(input || '').trim().startsWith('+')) return String(input).trim();
    return `+${digits}`;
  } catch {
    return null;
  }
}

export function buildTilledIndividualPayload(params) {
  const {
    spMcc,
    addr1, addr2, city, state, postal,
    supportEmail, supportPhone,
    profileName, userEmail,
    ssnDigits, dobIso,
  } = params;

  const legal_entity = {
    mcc: spMcc,
    region: 'US',
    address: {
      street: addr1 || '',
      street2: addr2 || null,
      city: city || '',
      state: state || '',
      postal_code: postal || '',
      country: 'US'
    },
    website: 'https://vybelocal.com/policies',
    is_501c3: false,
    structure: 'sole_proprietorship',
    legal_name: profileName || userEmail || 'VybeLocal User',
    principals: [
      {
        email: supportEmail || userEmail || null,
        phone: toE164US(supportPhone),
        address: {
          street: addr1 || '',
          street2: addr2 || null,
          city: city || '',
          state: state || '',
          postal_code: postal || '',
          country: 'US'
        },
        id_number: ssnDigits || null,
        job_title: 'owner',
        last_name: (profileName?.split?.(' ')?.slice(-1)[0] || 'User'),
        first_name: (profileName?.split?.(' ')?.[0] || 'Vybe'),
        is_applicant: true,
        date_of_birth: dobIso || null,
        is_control_prong: true,
        previous_address: null,
        percent_ownership: 100
      }
    ],
    bank_account: null,
    support_email: userEmail || null,
    support_phone: supportPhone ? toE164US(supportPhone) : null,
    tax_id_number: ssnDigits || null,
    charity_document: null,
    processing_volume: {
      currency: 'usd',
      high_ticket_amount: 50 * 100,
      monthly_processing_volume: 500 * 100,
      monthly_transaction_count: 50,
      average_transaction_amount_card: 25 * 100,
      average_transaction_amount_debit: 25 * 100,
    },
    number_of_terminals: null,
    patriot_act_details: {
      business_license: null,
      articles_of_incorporation: null
    },
    product_description: mccDescription(spMcc),
    statement_descriptor: 'VYBELOCAL*EVENT',
    date_of_incorporation: null,
    existing_processor_name: 'None',
    percent_business_to_business: 0,
    days_billed_prior_to_shipment: 0,
    card_checkout_method_breakdown: {
      percent_swiped: 0,
      percent_e_commerce: 100,
      percent_manual_card_not_present: 0
    }
  };
  return { legal_entity, tos_acceptance: true };
}

export function buildTilledBusinessPayload(params) {
  const {
    bizType,
    bizLegalName,
    bizEin,
    bizIncorpIso,
    addr1, addr2, city, state, postal,
    bizWebsite,
    bizSupportEmail,
    bizSupportPhone,
    bizMcc,
    bankHolder, bankRoutingDigits, bankAccountDigits, bankName,
    controlPerson,
  } = params;

  const business = {
    type: bizType === '501c3' ? 'corporation' : 'llc',
    legal_name: bizLegalName,
    tax_id: digitsOrNull(bizEin),
    start_or_incorp_date: bizIncorpIso,
    address: { line1: addr1, line2: addr2 || null, city, state, postal_code: postal },
    website: normalizeUrl(bizWebsite),
    support: { email: bizSupportEmail, phone: toE164US(bizSupportPhone) },
    mcc: bizMcc || '7922',
    is_501c3: bizType === '501c3',
  };

  const bank = {
    holder: bankHolder || bizLegalName,
    routing: bankRoutingDigits,
    account: bankAccountDigits,
    bank_name: bankName || null,
  };

  const control_person = controlPerson; // already normalized upstream

  return { business, bank, control_person };
}

// Helpers
function digitsOrNull(v) { const d = String(v || '').replace(/\D/g, ''); return d || null; }
function normalizeUrl(val) { const v = String(val||'').trim(); if (!v) return ''; if (/^https?:\/\//i.test(v)) return v; return `https://${v}`; }
function mccDescription(mcc) {
  const code = String(mcc || '').trim();
  if (code === '7922') return 'Ticketed shows and events (admission via VybeLocal)';
  if (code === '5812' || code === '5814') return 'Food and beverage events (pop-ups, tastings) hosted via VybeLocal';
  return 'Local classes and community events hosted via VybeLocal';
}


