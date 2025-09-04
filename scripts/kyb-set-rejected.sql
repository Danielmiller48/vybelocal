-- Sets KYB status to 'rejected'

update public.profiles
set tilled_status = 'rejected',
    tilled_required = null,
    bank_verification_status = null,
    last_webhook_at = now()
where id = '44ece390-8c1c-4d39-a668-4a322c1e10a1';


