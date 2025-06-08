// app/api/debug/route.js   (delete later)
import { supabase as createSupabase } from '@/utils/supabase/server'

export async function GET() {
  const supabase = createSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return new Response(JSON.stringify(user, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  })
}
