-- Danger: run in Supabase SQL editor (service role) for testing only
-- Sets KYB status to 'started' for the specified user

update public.profiles
set tilled_status = 'started',
    tilled_required = null,
    bank_verification_status = null,
    last_webhook_at = now()
where id = '44ece390-8c1c-4d39-a668-4a322c1e10a1';


