// utils/auth-helpers.js
import { createSupabaseServer } from './supabase/server';

/**
 * Extract user ID from JWT token in request
 * @param {Request} req - Next.js request object
 * @returns {string|null} User ID or null if not authenticated
 */
export async function getUserIdFromJwt(req) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.id) return null;
  return user.id;
}

/**
 * Get user ID from session (for server components)
 * @param {Request} req - Next.js request object
 * @returns {Promise<string|null>} User ID or null if not authenticated
 */
export async function getUserIdFromSession(req) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  return (!error && user?.id) ? user.id : null;
} 