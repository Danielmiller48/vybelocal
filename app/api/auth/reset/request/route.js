import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req){
  try{
    const { email } = await req.json()
    if(!email) return NextResponse.json({ error:'Missing email' },{ status:400 })

    // Supabase magic link password reset
    const redirectTo = (process.env.NEXT_PUBLIC_BASE_URL || 'https://vybelocal.com') + '/reset'
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if(error) return NextResponse.json({ error: error.message }, { status:400 })
    return NextResponse.json({ ok:true })
  }catch(err){
    return NextResponse.json({ error: 'Internal server error' }, { status:500 })
  }
}


