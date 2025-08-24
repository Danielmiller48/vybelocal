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

  /* ── trigger moderation for profile update ── */
  try {
    console.log('Triggering moderation for profile update:', user.id);
    const modResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3003'}/api/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'user', id: user.id }),
    });
    
    if (!modResponse.ok) {
      const modError = await modResponse.json();
      console.error('Profile moderation failed:', modError);
      throw new Error(modError.reason || 'Content moderation failed');
    } else {
      console.log('Profile moderation triggered successfully');
    }
  } catch (modError) {
    console.error('Profile moderation error:', modError);
    throw new Error(modError.message || 'Content moderation failed - please try again');
  }
}
