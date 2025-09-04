-- Sets KYB status to 'active'

update public.profiles
set tilled_status = 'active',
    tilled_required = null,
    bank_verification_status = 'verified',
    last_webhook_at = now()
where id = '44ece390-8c1c-4d39-a668-4a322c1e10a1';


