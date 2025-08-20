# Backend Write Lockdown – Smoke Test Guide

This document outlines step-by-step tests for every client write we routed through the waitlist API. Use it after changes to triggers/RLS/functions or API handlers to verify end-to-end behavior. Keep this up to date when policies or triggers change.

Setup
- API base: https://vybelocal.com (replace with preview URL if deploying to preview)
- Auth: Use a real user JWT from Supabase (mobile app or Supabase auth) as Bearer token
- Test data: One normal user (guest), one host with at least one event
- Tools: curl/Postman + SQL console (Supabase SQL editor or psql)

Conventions
- Replace {EVENT_ID}, {HOST_ID}, {USER_ID}, {JWT}
- SQL should return expected row counts or values; verify and clean up created rows

A) RSVPs – Join and Cancel
1) Pre-clean
```sql
DELETE FROM rsvps WHERE event_id = '{EVENT_ID}' AND user_id = '{USER_ID}';
DELETE FROM notifications WHERE user_id = '{HOST_ID}' AND type = 'rsvp';
```
2) Join via API
```bash
curl -s -X POST \
  -H "Authorization: Bearer {JWT}" \
  "https://vybelocal.com/api/events/{EVENT_ID}/rsvps/join"
```
3) Verify insert + triggers
```sql
SELECT COUNT(*) FROM rsvps WHERE event_id = '{EVENT_ID}' AND user_id = '{USER_ID}'; -- expect 1
-- Notification created for host (implementation uses upsert_rsvp_notification)
SELECT COUNT(*) FROM notifications 
  WHERE type = 'rsvp' AND reference_id = '{EVENT_ID}' AND user_id = '{HOST_ID}'; -- >= 1
```
4) Duplicate join idempotency
```bash
curl -s -X POST -H "Authorization: Bearer {JWT}" "https://vybelocal.com/api/events/{EVENT_ID}/rsvps/join"
```
Expect 200 or 409 handled gracefully; no duplicate row due to unique constraints (if present).

5) Capacity enforcement (optional)
- Set event rsvp_capacity to current count, attempt join with another user → expect capacity rejection (409)

6) Cancel via API
```bash
curl -s -X POST \
  -H "Authorization: Bearer {JWT}" \
  "https://vybelocal.com/api/events/{EVENT_ID}/rsvps/cancel"
```
7) Verify delete + notification cleanup
```sql
SELECT COUNT(*) FROM rsvps WHERE event_id = '{EVENT_ID}' AND user_id = '{USER_ID}'; -- expect 0
-- After delete trigger should remove rsvp notification if present
```

B) Blocks – Block/Unblock User
1) Block user
```bash
curl -s -X POST \
  -H "Authorization: Bearer {JWT}" \
  -H "Content-Type: application/json" \
  -d '{"target_id":"{HOST_ID}"}' \
  "https://vybelocal.com/api/blocks"
```
2) Verify
```sql
SELECT COUNT(*) FROM blocks 
  WHERE blocker_id = '{USER_ID}' AND target_type='user' AND target_id='{HOST_ID}'; -- expect 1
```
3) Unblock
```bash
curl -s -X DELETE \
  -H "Authorization: Bearer {JWT}" \
  "https://vybelocal.com/api/blocks?target_id={HOST_ID}"
```
4) Verify
```sql
SELECT COUNT(*) FROM blocks 
  WHERE blocker_id = '{USER_ID}' AND target_type='user' AND target_id='{HOST_ID}'; -- expect 0
```

C) Flags – Report Event and User
1) Report event
```bash
curl -s -X POST \
  -H "Authorization: Bearer {JWT}" -H "Content-Type: application/json" \
  -d '{"target_type":"event","target_id":"{EVENT_ID}","reason_code":"unsafe","details":{"explanation":"test"},"severity":1}' \
  "https://vybelocal.com/api/flags"
```
2) Report user
```bash
curl -s -X POST \
  -H "Authorization: Bearer {JWT}" -H "Content-Type: application/json" \
  -d '{"target_type":"user","target_id":"{HOST_ID}","reason_code":"harassment","details":"test","severity":1}' \
  "https://vybelocal.com/api/flags"
```
3) Verify
```sql
SELECT COUNT(*) FROM flags WHERE reporter_id = '{USER_ID}' AND target_id IN ('{EVENT_ID}','{HOST_ID}'); -- >= 2
```

D) Follows – Follow/Unfollow Host
1) Follow
```bash
curl -s -X POST \
  -H "Authorization: Bearer {JWT}" -H "Content-Type: application/json" \
  -d '{"host_id":"{HOST_ID}"}' \
  "https://vybelocal.com/api/follows"
```
2) Verify
```sql
SELECT COUNT(*) FROM host_follows WHERE follower_id='{USER_ID}' AND host_id='{HOST_ID}'; -- expect 1
```
3) Unfollow
```bash
curl -s -X DELETE \
  -H "Authorization: Bearer {JWT}" \
  "https://vybelocal.com/api/follows?host_id={HOST_ID}"
```
4) Verify
```sql
SELECT COUNT(*) FROM host_follows WHERE follower_id='{USER_ID}' AND host_id='{HOST_ID}'; -- expect 0
```

E) Notifications – Delete, Clear All, Mark Chat Read
1) Seed (optional if existing rows)
```sql
INSERT INTO notifications(user_id,type,title,message,reference_id,reference_table,batch_count)
VALUES ('{USER_ID}','chat_message','t','m','{EVENT_ID}','events',2);
```
2) Delete one
```bash
curl -s -X DELETE -H "Authorization: Bearer {JWT}" \
  "https://vybelocal.com/api/notifications?id={NOTIF_ID}"
```
Verify row removed.

3) Clear all for user
```bash
curl -s -X DELETE -H "Authorization: Bearer {JWT}" \
  "https://vybelocal.com/api/notifications?all=true"
```
Verify user has 0 rows in notifications.

4) Mark chat read
```bash
curl -s -X POST -H "Authorization: Bearer {JWT}" -H "Content-Type: application/json" \
  -d '{"event_id":"{EVENT_ID}"}' \
  "https://vybelocal.com/api/notifications"
```
Verify with your version of `mark_chat_notifications_read` side effects, e.g. rows for (user_id={USER_ID}, type='chat_message', reference_id={EVENT_ID}) reflect read/dismissed state.

F) Event Cancel
1) Preview (optional)
```bash
curl -s -X GET -H "Authorization: Bearer {JWT}" \
  "https://vybelocal.com/api/events/{EVENT_ID}/cancel"
```
2) Cancel
```bash
curl -s -X PATCH -H "Authorization: Bearer {JWT}" -H "Content-Type: application/json" \
  -d '{"reason_text":"testing"}' \
  "https://vybelocal.com/api/events/{EVENT_ID}/cancel"
```
3) Verify
```sql
SELECT status,canceled_at FROM events WHERE id='{EVENT_ID}'; -- status='canceled'
-- Trigger side-effects on RSVPs should be applied by mark_rsvps_host_canceled()
-- If guests existed, host_cancel_strikes row may be inserted by API; check latest:
SELECT COUNT(*) FROM host_cancel_strikes WHERE event_id='{EVENT_ID}';
```

G) Push Tokens – Upsert
1) Save token
```bash
curl -s -X POST -H "Authorization: Bearer {JWT}" -H "Content-Type: application/json" \
  -d '{"push_token":"ExponentPushToken[xxxx]","platform":"ios"}' \
  "https://vybelocal.com/api/push-tokens"
```
2) Verify
```sql
SELECT push_token, platform FROM user_push_tokens WHERE user_id='{USER_ID}' AND platform='ios';
```

H) Images – Presign + Upload (FYI)
- Already backend-controlled via presign + uploadToSignedUrl + commit. To sanity check:
  1) POST /api/events/images/presign with eventId and contentType, expect path+token
  2) Upload to signed URL via storage helper
  3) POST /api/events/images/commit with eventId and path

Clean-up
- Remove test flags/follows/notifications/push tokens as needed to return environment to baseline

Troubleshooting
- 401: verify Bearer JWT and that the user exists
- 409 on RSVP join: capacity or duplicate
- If triggers/policies change, update this document and the RLS snapshot files in migrations/db accordingly

I) Profile Phone – Start + Verify (10-digit only)
1) Start phone change (sends code to current email)
```bash
curl -s -X PATCH -H "Authorization: Bearer {JWT}" -H "Content-Type: application/json" \
  -d '{"phone":"915-555-1212"}' \
  "https://vybelocal.com/api/profile/phone"
```
Expect JSON: { success: true, requiresVerification: true, newPhone: "9155551212" }

2) Verify with the 6-digit code received via email
```bash
curl -s -X POST -H "Authorization: Bearer {JWT}" -H "Content-Type: application/json" \
  -d '{"code":"{CODE}"}' \
  "https://vybelocal.com/api/profile/phone/verify"
```
Verify in SQL:
```sql
SELECT phone FROM profiles WHERE id='{USER_ID}'; -- expect 10-digit string (xxxxxxxxxx)
SELECT COUNT(*) FROM pending_phone_changes WHERE user_id='{USER_ID}'; -- expect 0
```

J) Event Create – Basic flow
1) Create event
```bash
curl -s -X POST -H "Authorization: Bearer {JWT}" -H "Content-Type: application/json" \
  -d '{
    "title":"Test Smoke Event",
    "description":"desc",
    "address":"123 Main St",
    "vibe":"chill",
    "starts_at":"2025-12-01T18:00:00.000Z",
    "ends_at":"2025-12-01T19:00:00.000Z",
    "refund_policy":"no_refund",
    "price_in_cents":null,
    "rsvp_capacity":5
  }' \
  "https://vybelocal.com/api/events"
```
2) Verify
```sql
SELECT id, host_id, status FROM events WHERE title='Test Smoke Event' ORDER BY created_at DESC LIMIT 1; -- status='approved'
```
3) Optional: Image presign + commit steps (see section H)
