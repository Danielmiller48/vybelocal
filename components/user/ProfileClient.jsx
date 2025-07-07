// ── components/ProfileClient.jsx ──
'use client'

import { useForm } from 'react-hook-form'
import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { saveProfile } from '@/app/user/actions'
import toast from 'react-hot-toast'

/*
 * Shows a signed avatar if one exists, otherwise a gray "?" placeholder.
 * Schema: id (uuid, pk) | name (req) | bio (55) | phone | avatar_url | email (dup)
 */
export default function ProfileClient({ profile }) {
  const supabase = createSupabaseBrowser()
  const router   = useRouter()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name:  profile?.name  ?? '',
      bio:   profile?.bio   ?? '',
      phone: profile?.phone ?? '',
      email: profile?.email ?? '',
    },
  })

  const [preview, setPreview]   = useState(null)
  const [avatarSrc, setAvatar]  = useState('/avatar-placeholder.png')
  const avatarFile = watch('avatar')

  /* ------------------------ load existing avatar ------------------------ */
  useEffect(() => {
    if (preview) {                // user picked a new file → instant preview
      setAvatar(preview)
      return
    }

    if (!profile?.avatar_url) {   // no avatar yet
      setAvatar('/avatar-placeholder.png')
      return
    }

    // bucket is private → fetch one-hour signed URL
    (async () => {
      const { data, error } = await supabase
        .storage
        .from('profile-images')
        .createSignedUrl(profile.avatar_url, 60 * 60)
      if (data?.signedUrl) setAvatar(data.signedUrl)
      else                 setAvatar('/avatar-placeholder.png')
    })()
  }, [preview, profile?.avatar_url, supabase])

  /* ------------------------ helpers ------------------------ */
  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (file) setPreview(URL.createObjectURL(file))
  }

  /* ------------------------ submit ------------------------ */
  async function onSubmit(values) {
    if (!profile?.id) {
      toast.error('Missing user id – cannot update profile')
      return
    }

    let avatar_url = profile?.avatar_url ?? null

    // 1⃣ upload avatar if user picked one -------------------------------------
    if (values.avatar?.[0]) {
      const file     = values.avatar[0]
      const filePath = `${profile.id}/${Date.now()}_${file.name}`

      const { error: uploadError } = await supabase
        .storage
        .from('profile-images')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        console.error('[SB-DEBUG] avatar upload error', uploadError)
        toast.error(`Avatar upload failed: ${uploadError.message}`)
        return
      }

      avatar_url = filePath
    }

    // 2⃣ build payload ---------------------------------------------------------
    const payload = {
      name: values.name || '',
      bio:  values.bio  || '',
      phone: values.phone || '',
      avatar_url,
    }

    console.log('[SB-DEBUG] save profile payload', payload)

    // 3⃣ use server action with moderation ------------------------------------
    try {
      await saveProfile(payload)
      toast.success('Profile updated successfully!')
      router.refresh()
    } catch (error) {
      console.error('[SB-DEBUG] profile save error', error)
      
      // Check if it's a moderation error
      if (error.message && error.message.includes('moderation')) {
        toast.error(`Profile update failed: ${error.message}`)
      } else {
        toast.error(`Profile save failed: ${error.message}`)
      }
    }
  }

  /* ------------------------ UI ------------------------ */
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-4 max-w-lg">
      {/* avatar */}
      <div className="flex items-center gap-4">
        <img
          src={avatarSrc}
          alt="avatar"
          className="w-20 h-20 rounded-full object-cover border"
          onError={(e) => { e.currentTarget.src = '/avatar-placeholder.png' }}
        />
        <input type="file" accept="image/*" {...register('avatar')} onChange={handleAvatarChange} />
      </div>

      {/* name */}
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input {...register('name', { required: true })} className="input w-full" />
        {errors.name && <p className="text-red-500 text-sm">Required</p>}
      </div>

      {/* bio */}
      <div>
        <label className="block text-sm font-medium">Bio (max 55 chars)</label>
        <input {...register('bio', { maxLength: 55 })} className="input w-full" />
      </div>

      {/* phone */}
      <div>
        <label className="block text-sm font-medium">Phone</label>
        <input {...register('phone')} className="input w-full" />
      </div>

      {/* email */}
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input type="email" {...register('email', { required: true })} className="input w-full" />
      </div>

      <button type="submit" disabled={isSubmitting} className="btn-primary disabled:opacity-50">
        {isSubmitting ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}