// scripts/debug-registration.js
// Run with: node scripts/debug-registration.js --email user@example.com [--phone 1234567890]
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY env vars

import 'dotenv/config';
import sbAdmin from '../utils/supabase/admin.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const val = args[i + 1];
    if (!val) continue;
    if (key === '--email') opts.email = val;
    if (key === '--phone') opts.phone = val.replace(/\D/g, ''); // digits only
  }
  return opts;
}

async function run() {
  const { email, phone } = parseArgs();
  if (!email && !phone) {
    console.error('Usage: node scripts/debug-registration.js --email user@example.com [--phone 1234567890]');
    process.exit(1);
  }

  console.log('🔍 Debugging registration duplicates');
  console.log('   email:', email || '—');
  console.log('   phone:', phone || '—');

  // 1) List matching auth.users
  const { data: list } = await sbAdmin.auth.admin.listUsers();
  const authMatches = list.users.filter(u => (email ? u.email === email : true));
  console.log(`\n📦 auth.users matches (${authMatches.length}):`);
  authMatches.forEach(u => console.log({ id: u.id, email: u.email, created_at: u.created_at }));

  // 2) profiles by email or phone
  const profileFilters = [];
  if (email) profileFilters.push(`email.eq.${email}`); // not indexed by default but okay for debug
  if (phone) profileFilters.push(`phone.eq.${phone}`);
  let profiles = [];
  if (profileFilters.length) {
    const { data } = await sbAdmin
      .from('profiles')
      .select('*')
      .or(profileFilters.join(','));
    profiles = data || [];
  }
  console.log(`\n📦 profiles matches (${profiles.length}):`);
  profiles.forEach(p => console.log(p));

  // 3) phone_numbers by phone if provided
  if (phone) {
    const { data: pn } = await sbAdmin
      .from('phone_numbers')
      .select('*')
      .eq('phone', phone);
    console.log(`\n📦 phone_numbers matches (${pn.length}):`);
    pn.forEach(r => console.log(r));
  }

  // 4) Orphan detection
  const orphanProfiles = profiles.filter(p => !authMatches.find(u => u.id === p.id));
  if (orphanProfiles.length) {
    console.log('\n⚠️  Orphan profiles (no matching auth.users):');
    orphanProfiles.forEach(p => console.log({ id: p.id, email: p.email, phone: p.phone }));
  }

  console.log('\n✅ Debug complete');
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
}); 