#!/usr/bin/env node
/**
 * scripts/create-test-user.js
 * ---------------------------
 * Creates a new Supabase auth user + profile row for testing.
 *
 * Usage:
 *   node scripts/create-test-user.js test2@example.com password "Test Two"
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const [,, email, pwd, name='Test User'] = process.argv;
if(!email || !pwd){
  console.error('Usage: node scripts/create-test-user.js <email> <password> [name]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url || !key){
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { autoRefreshToken:false, persistSession:false }});

(async ()=>{
  // 1️⃣ create auth user
  const { data: user, error: uErr } = await sb.auth.admin.createUser({
    email,
    password: pwd,
    email_confirm: true,
  });
  if(uErr){ console.error(uErr); process.exit(1);} 
  console.log('Created auth user', user.id);

  // 2️⃣ insert empty profile row
  const { error: pErr } = await sb.from('profiles').insert({ id:user.id, email, name });
  if(pErr){ console.error('Profile insert error', pErr); process.exit(1);} 
  console.log('Profile row inserted.');
})(); 