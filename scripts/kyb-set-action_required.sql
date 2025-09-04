-- Sets KYB status to 'action_required' with example requirements

update public.profiles
set tilled_status = 'action_required',
    tilled_required = '["business_document","bank_account"]'::jsonb,
    bank_verification_status = 'pending',
    last_webhook_at = now()
where id = '44ece390-8c1c-4d39-a668-4a322c1e10a1';


