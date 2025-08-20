-- Simple version - just replace the UUIDs and run
-- REPLACE THESE WITH ACTUAL UUIDs:
-- AUTH_USER_ID: from auth.users table
-- PROFILE_ID: from profiles table (usually same as auth_user_id)

SELECT 'auth.users' as table_name, COUNT(*) as count
FROM auth.users 
WHERE id = 'REPLACE-WITH-AUTH-USER-ID'

UNION ALL

SELECT 'profiles', COUNT(*)
FROM profiles 
WHERE id = 'REPLACE-WITH-PROFILE-ID'

UNION ALL

SELECT 'notifications', COUNT(*)
FROM notifications 
WHERE user_id = 'REPLACE-WITH-AUTH-USER-ID'

UNION ALL

SELECT 'blocks', COUNT(*)
FROM blocks 
WHERE blocker_id = 'REPLACE-WITH-AUTH-USER-ID'

UNION ALL

SELECT 'host_follows (follower)', COUNT(*)
FROM host_follows 
WHERE follower_id = 'REPLACE-WITH-PROFILE-ID'

UNION ALL

SELECT 'host_follows (host)', COUNT(*)
FROM host_follows 
WHERE host_id = 'REPLACE-WITH-PROFILE-ID'

UNION ALL

SELECT 'flags (reporter)', COUNT(*)
FROM flags 
WHERE reporter_id = 'REPLACE-WITH-PROFILE-ID'

UNION ALL

SELECT 'flags (target)', COUNT(*)
FROM flags 
WHERE user_id = 'REPLACE-WITH-PROFILE-ID'

UNION ALL

SELECT 'rsvps', COUNT(*)
FROM rsvps 
WHERE user_id = 'REPLACE-WITH-PROFILE-ID'

UNION ALL

SELECT 'events', COUNT(*)
FROM events 
WHERE host_id = 'REPLACE-WITH-PROFILE-ID'

UNION ALL

SELECT 'host_cancel_strikes', COUNT(*)
FROM host_cancel_strikes 
WHERE host_id = 'REPLACE-WITH-PROFILE-ID'

UNION ALL

SELECT 'account_deletion_requests', COUNT(*)
FROM account_deletion_requests 
WHERE user_id = 'REPLACE-WITH-AUTH-USER-ID'

ORDER BY table_name;
