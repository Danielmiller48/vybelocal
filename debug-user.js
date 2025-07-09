// Debug script to find problematic user data
import sbAdmin from './utils/supabase/admin.js';

async function findProblematicUser() {
  const userId = '28fb8c62-d697-4bb8-adb1-8e45f2a50099';
  
  console.log('🔍 Searching for user data...');
  
  // Check auth.users
  try {
    const { data: authUser, error: authError } = await sbAdmin.auth.admin.getUserById(userId);
    if (authError) {
      console.log('❌ Auth user not found:', authError.message);
    } else {
      console.log('✅ Auth user found:', {
        id: authUser.user.id,
        email: authUser.user.email,
        created_at: authUser.user.created_at
      });
    }
  } catch (error) {
    console.log('❌ Error checking auth user:', error.message);
  }
  
  // Check profiles table
  try {
    const { data: profile, error: profileError } = await sbAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (profileError) {
      console.log('❌ Profile not found:', profileError.message);
    } else {
      console.log('✅ Profile found:', profile);
    }
  } catch (error) {
    console.log('❌ Error checking profile:', error.message);
  }
  
  // Check phone_numbers table
  try {
    const { data: phoneNumbers, error: phoneError } = await sbAdmin
      .from('phone_numbers')
      .select('*')
      .eq('user_id', userId);
      
    if (phoneError) {
      console.log('❌ Phone numbers not found:', phoneError.message);
    } else {
      console.log('✅ Phone numbers found:', phoneNumbers);
    }
  } catch (error) {
    console.log('❌ Error checking phone numbers:', error.message);
  }
}

findProblematicUser().catch(console.error); 