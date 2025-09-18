a177c8e  2025-09-08 12:53:44 -0600  fix(kyb): remove KybTypeScreen import/route after rollback
ef52f25  2025-09-08 12:44:52 -0600  revert(kyb): remove interim type screen; route intro -> Moov directly; pass MCC; Drop only applies MCC
6d58014  2025-09-08 12:39:11 -0600  ux(moov): remove interim; add inline type+curated MCC picker inside Drop page and apply via profile PATCH before opening
35ea18e  2025-09-08 12:33:39 -0600  feat(moov): preset entity type in Drop (individualProfile or businessProfile); business still sets MCC
d0e8f07  2025-09-08 12:30:16 -0600  chore(kyb): speed up MCC expand animation to 200ms
0c44b79  2025-09-08 12:29:53 -0600  feat(kyb): center type screen and animate business MCC expand (300ms)
a3207fc  2025-09-08 12:23:30 -0600  feat(moov): interim type picker (individual/business) + MCC picker; route Start -> KybType; set MCC only for business before Drop
ef78708  2025-09-05 20:05:02 -0600  feat(waitlist): add follows API and backend cancel routing
4ba1a4b  2025-09-04 11:59:09 -0600  chore(dev): add quick SQL scripts to toggle KYB status for 44ece390-8c1c-4d39-a668-4a322c1e10a1
3a9fc3f  2025-09-04 08:56:52 -0600  feat(settings): add PayoutsStateGate and integrate with KYB status endpoint
9cde44b  2025-09-04 08:39:17 -0600  chore(kyb): checkpoint root + submodule before payouts state work
6050fb0  2025-08-30 15:28:53 -0600  Mobile KYB: center-aligned content (maxWidth 420) + centered floating footer
38a47b4  2025-08-30 15:23:30 -0600  Mobile: KYB animated dropdown + session draft + footer CTAs
63a985a  2025-08-29 11:10:15 -0600  Mobile: Add status check before account creation
073a00f  2025-08-28 15:45:04 -0600  Mobile: Multi-step KYB form with animations, industry dropdown, connected account creation, auto-fill boilerplate
33595fd  2025-08-27 22:07:42 -0600  Mobile: KYB individual defaults (MCC 7922, boilerplate description), optional website; quick-pick processing estimates; avatar header fixes; auth provider profile select fix
c624df4  2025-08-26 14:10:49 -0600  chore(waitlist): bump submodule to deploy console
48af38c  2025-08-26 12:27:13 -0600  mobile(header): add admin-only button for profiles with is_admin; links to /admin
10a5233  2025-08-26 11:36:12 -0600  mobile: commit current changes (RSVP waitlist routing, profile/settings updates, new eas.json)
003506c  2025-08-26 08:50:13 -0600  waitlist: add /api/rsvps route (GET count/joined, POST, DELETE)
1442b68  2025-08-26 08:20:35 -0600  mobile/api: move RSVP create/delete and flags report behind server API; add rsvps DELETE handler and joined flag to GET
664ea1a  2025-08-25 22:12:28 -0600  chore: bump submodule pointer (waitlist forgot/reset)
5ba98b2  2025-08-25 18:18:17 -0600  chore: bump submodule pointer (verify path route)
f835d2a  2025-08-25 17:58:51 -0600  mobile: log email-change request/response for debugging
20d97a9  2025-08-25 17:51:18 -0600  chore: bump submodule pointer (email runtime+logging)
231d90d  2025-08-25 17:43:48 -0600  chore: bump submodule pointer (verify path token)
862c954  2025-08-25 17:39:13 -0600  chore: bump submodule pointer (email send-sms timeout)
080082a  2025-08-25 17:20:04 -0600  chore: bump submodule pointer (verify deep-link)
f30e7db  2025-08-25 17:14:24 -0600  chore: bump waitlist submodule pointer (verify redirect)
f1c0c02  2025-08-25 17:02:23 -0600  chore: bump waitlist submodule pointer (verify-email tweaks)
81afc25  2025-08-25 16:53:04 -0600  chore: bump waitlist submodule; UX: disable double-submit in mobile
c75f7b0  2025-08-25 16:44:51 -0600  chore: bump waitlist submodule pointer (email link verification)
6a082ca  2025-08-25 16:27:05 -0600  chore: bump waitlist submodule pointer
bdc0473  2025-08-25 14:20:35 -0600  chore: cleanup android artifacts; waitlist register flow wired; misc fixes; prep for host drawer API refactor
e8cf543  2025-08-24 17:56:31 -0600  mobile(analytics): wire Refund Rate to analytics.host_refund_stats; add prefetch and detailed logs; fix schema call; add refunds backfill migration
b7cf729  2025-08-24 15:27:48 -0600  mobile(analytics): wire peak RSVP window to analytics.host_monthly buckets; fix series windows; revenue/after-tax use net series; remove repeat guest rate; logs for host_monthly fetch and peak aggregation
a22caba  2025-08-24 13:18:07 -0600  merge: tilled-migration into main
a30895f  2025-08-24 13:17:04 -0600  chore: bump waitlist submodule to d3535ff
1417eee  2025-08-24 08:37:46 -0600  analytics(rollups): use net_to_host_cents for host_live.total_revenue_cents; recompute from host_monthly; fix seed scripts; backfill step required
5d165e4  2025-08-23 14:16:05 -0600  mobile(analytics): add Top Revenue events table in avg revenue modal; fix host_monthly net_to_host aggregates; backfill event_live/daily seed + 30d RPCs; cleanup logs; keep public.events intact in cleanup[33m741b77b[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m)[m config(moov-drop): explicitly set open=true and microDeposits=true
[33m76372e6[m feat(moov-drop): add comprehensive event handlers (onError, onCancel, onSuccess)
[33m82caccb[m fix(moov-drop): re-enable capabilities request (transfers, collect-funds, wallet) - was disabled during troubleshooting
[33m79c83a8[m feat(moov-drop): add token refresh for all resource types (paymentMethod, bankAccount)
[33m7d1589c[m feat: update RSVPButton for Moov payment integration
[33m4d31bc8[m fix(mobile): remove KybType nav; request wallet+collect-funds on account create; finish closes via moov:done
[33me3f48aa[m revert(mobile): restore Drop flow from a3207fc for Moov onboarding
[33mef52f25[m revert(kyb): remove interim type screen; route intro -> Moov directly; pass MCC; Drop only applies MCC
[33m6d58014[m ux(moov): remove interim; add inline type+curated MCC picker inside Drop page and apply via profile PATCH before opening
[33m35ea18e[m feat(moov): preset entity type in Drop (individualProfile or businessProfile); business still sets MCC
