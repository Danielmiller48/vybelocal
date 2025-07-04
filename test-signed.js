// test-signed.js
import { createClient } from '@supabase/supabase-js'

// --- hard-coded creds just for this quick test --------------------
const supabaseUrl = 'https://tzwksdoffzoerzcfsucm.supabase.co'
const anonKey     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6d2tzZG9mZnpvZXJ6Y2ZzdWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NjY5OTMsImV4cCI6MjA2NDU0Mjk5M30.bZocX46q4n2BreGW686eTQ8mqXyT9zPR7f30h-izVyg'
//------------------------------------------------------------------

const supabase = createClient(supabaseUrl, anonKey)

const key =
  'a676ec2d-439e-43b5-bb3f-e34d3d7bbefa' // the bare key we saved

const { data, error } = await supabase
  .storage
  .from('event-images')
  .createSignedUrl(key, 3600)

if (error) {
  console.error('❌  Error:', error)
} else {
  console.log('\n✅  Signed URL:\n', data.signedUrl, '\n')
}

process.exit()
