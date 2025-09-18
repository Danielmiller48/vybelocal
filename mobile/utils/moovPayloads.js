// Moov payload builders — pure helpers to assemble request bodies for our backend
// Reference: Moov Accounts, Representatives, Bank Accounts, Capabilities APIs
// Keep these small and composable so screens can call them without importing SDKs

/* JSDoc typedefs for clarity (JS project) */
/** @typedef {{ line1:string, line2?:string|null, city:string, state:string, postal:string, country?:'US' }} UiAddress */

const countryUS = 'US';

export function normalizeMoovAddress(addr /** @type {UiAddress} */) {
  return {
    line1: addr?.line1 || '',
    line2: addr?.line2 || null,
    city: addr?.city || '',
    stateOrProvince: addr?.state || '',
    postalCode: addr?.postal || '',
    country: countryUS,
  };
}

export function toDigits(val) {
  return String(val || '').replace(/\D/g, '');
}

export function toE164US(input) {
  try {
    const digits = String(input || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (String(input || '').trim().startsWith('+')) return String(input).trim();
    return `+${digits}`;
  } catch { return null; }
}

export function normalizeUrl(val) {
  const v = String(val || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

// Business account profile payload for Moov
export function buildMoovBusinessProfile({
  legalName,
  dba,
  ein,
  address,
  supportEmail,
  supportPhone,
  website,
  mcc,
  naics,
}) {
  return {
    profile: {
      business: {
        legalBusinessName: legalName || '',
        doingBusinessAs: dba || null,
        taxID: toDigits(ein) || null,
        address: normalizeMoovAddress(address || {}),
        email: supportEmail || null,
        phone: toE164US(supportPhone) || null,
        website: normalizeUrl(website || ''),
      },
      mcc: mcc || '7922',
      naics: naics || '711310',
    },
  };
}

// Underwriting block for Moov
export function buildMoovUnderwriting({
  productDescription,
  averageTicketAmount,
  monthlyVolume,
  monthlyTransactionCount,
  daysUntilFulfillment,
  checkoutMix,
  b2bPercent,
}) {
  return {
    underwriting: {
      productDescription: productDescription || 'Event admission and hosting services',
      averageTicketAmount: Number(averageTicketAmount || 50),
      monthlyVolume: Number(monthlyVolume || 5000),
      monthlyTransactionCount: Number(monthlyTransactionCount || 100),
      daysUntilFulfillment: Number(daysUntilFulfillment || 1),
      checkoutMix: checkoutMix || { in_person: 80, online: 20 },
      volumeByCustomerType: (() => {
        const b2b = Math.max(0, Math.min(100, Number(b2bPercent ?? 0)));
        const b2c = Math.max(0, Math.min(100, 100 - b2b));
        return { b2bPercent: b2b, b2cPercent: b2c };
      })(),
    },
  };
}

// Representative (control person) structure for Moov
export function buildMoovRepresentative({
  firstName,
  lastName,
  email,
  phone,
  ssnDigits,
  dobIso, // YYYY-MM-DD
  address,
  title,
  ownership,
  isController = true,
}) {
  return {
    name: { firstName, lastName },
    email: email || null,
    phone: toE164US(phone) || null,
    ssn: toDigits(ssnDigits) || null,
    birthDate: dobIso || null,
    address: normalizeMoovAddress(address || {}),
    title: title || 'owner',
    ownershipPercentage: Number(ownership || 0),
    isController: !!isController,
  };
}

// Bank account structure for Moov
export function buildMoovBankAccount({
  holderName,
  routingNumber,
  accountNumber,
  bankName,
  type = 'checking',
}) {
  return {
    holderName: holderName || null,
    routingNumber: toDigits(routingNumber) || null,
    accountNumber: toDigits(accountNumber) || null,
    bankName: bankName || null,
    type,
  };
}

// Capabilities request body
export function buildMoovCapabilities(capabilities) {
  const caps = capabilities && capabilities.length
    ? capabilities
    : ['transfers', 'collect-funds', 'wallet'];
  return caps;
}

// TOS patch body
export function buildMoovTosPatch({ tosToken }) {
  return { tosToken: tosToken || null };
}


