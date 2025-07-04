// app/user/actions.js
'use server'

import { createSupabaseServer } from '@/utils/supabase/server'

export async function saveProfile({ name, bio, phone, avatar_url }) {
  const supabase = await createSupabaseServer()      // ← already has user JWT
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await supabase
    .from('profiles')
    .update({ name, bio, phone, avatar_url }, { returning: 'minimal' })
    .eq('id', user.id)
}
