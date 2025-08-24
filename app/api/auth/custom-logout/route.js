// app/api/auth/custom-logout/route.js
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function POST(request) {
  const supabase = await createSupabaseServer();
  
  // Sign out from Supabase
  await supabase.auth.signOut();
  
  // Create response
  const response = NextResponse.json({ success: true });
  
  // Clear Supabase cookies
  response.cookies.delete('sb-tzwksdoffzoerzcfsucm-auth-token');
  response.cookies.delete('sb-tzwksdoffzoerzcfsucm-auth-token.0');
  response.cookies.delete('sb-tzwksdoffzoerzcfsucm-auth-token.1');
  
  return response;
} 