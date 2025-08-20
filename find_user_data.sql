-- Find all data tied to specific user UUIDs
-- Replace 'YOUR-AUTH-USER-ID' and 'YOUR-PROFILE-ID' with actual IDs

-- Set your IDs here (replace these)
\set auth_user_id 'YOUR-AUTH-USER-ID-HERE'
\set profile_id 'YOUR-PROFILE-ID-HERE'

-- Or use this version with direct substitution:

WITH user_ids AS (
  SELECT 
    'YOUR-AUTH-USER-ID-HERE'::uuid as auth_user_id,
    'YOUR-PROFILE-ID-HERE'::uuid as profile_id
)

-- Auth Users Table
SELECT 'auth.users' as table_name, 'auth_user_id' as match_column, COUNT(*) as count
FROM auth.users, user_ids
WHERE auth.users.id = user_ids.auth_user_id

UNION ALL

-- Profiles Table  
SELECT 'profiles', 'profile_id', COUNT(*)
FROM profiles, user_ids
WHERE profiles.id = user_ids.profile_id

UNION ALL

-- Notifications (by auth user_id)
SELECT 'notifications', 'user_id', COUNT(*)
FROM notifications, user_ids
WHERE notifications.user_id = user_ids.auth_user_id

UNION ALL

-- Blocks (as blocker, by auth user_id)
SELECT 'blocks (as blocker)', 'blocker_id', COUNT(*)
FROM blocks, user_ids
WHERE blocks.blocker_id = user_ids.auth_user_id

UNION ALL

-- Host Follows (as follower)
SELECT 'host_follows (as follower)', 'follower_id', COUNT(*)
FROM host_follows, user_ids
WHERE host_follows.follower_id = user_ids.profile_id

UNION ALL

-- Host Follows (as host being followed)
SELECT 'host_follows (as host)', 'host_id', COUNT(*)
FROM host_follows, user_ids
WHERE host_follows.host_id = user_ids.profile_id

UNION ALL

-- Flags (as reporter)
SELECT 'flags (as reporter)', 'reporter_id', COUNT(*)
FROM flags, user_ids
WHERE flags.reporter_id = user_ids.profile_id

UNION ALL

-- Flags (as target)
SELECT 'flags (as target)', 'user_id', COUNT(*)
FROM flags, user_ids
WHERE flags.user_id = user_ids.profile_id

UNION ALL

-- RSVPs
SELECT 'rsvps', 'user_id', COUNT(*)
FROM rsvps, user_ids
WHERE rsvps.user_id = user_ids.profile_id

UNION ALL

-- Events (as host)
SELECT 'events (as host)', 'host_id', COUNT(*)
FROM events, user_ids
WHERE events.host_id = user_ids.profile_id

UNION ALL

-- Host Cancel Strikes
SELECT 'host_cancel_strikes', 'host_id', COUNT(*)
FROM host_cancel_strikes, user_ids
WHERE host_cancel_strikes.host_id = user_ids.profile_id

UNION ALL

-- Phone Numbers (if exists)
SELECT 'phone_numbers', 'profile_id', COUNT(*)
FROM phone_numbers, user_ids
WHERE phone_numbers.profile_id = user_ids.profile_id

UNION ALL

-- Payments (via RSVPs)
SELECT 'payments (via rsvps)', 'rsvp_id->user_id', COUNT(*)
FROM payments p
JOIN rsvps r ON p.rsvp_id = r.id, user_ids
WHERE r.user_id = user_ids.profile_id

UNION ALL

-- Account Deletion Requests
SELECT 'account_deletion_requests', 'user_id', COUNT(*)
FROM account_deletion_requests, user_ids
WHERE account_deletion_requests.user_id = user_ids.auth_user_id

ORDER BY table_name;
