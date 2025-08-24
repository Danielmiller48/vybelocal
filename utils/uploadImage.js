// utils/uploadImage.js
'use client'

import { v4 as uuid } from 'uuid'

/**
 * Uploads a File object to the private “event-images” bucket
 * Returns the storage key you should store in events.img_path
 */
export async function uploadImage(supabase, file) {
  const ext      = file.name.split('.').pop()
  const filePath = `${uuid()}/${uuid()}.${ext}`

  const { error } = await supabase
    .storage
    .from('event-images')
    .upload(filePath, file, { upsert: false })

  if (error) throw error
  return filePath          // key only
}
