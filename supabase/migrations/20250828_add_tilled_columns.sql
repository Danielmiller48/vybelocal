-- Add Tilled-related columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tilled_account_id TEXT,
ADD COLUMN IF NOT EXISTS tilled_merchant_id TEXT, 
ADD COLUMN IF NOT EXISTS tilled_status TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_tilled_account_id ON public.profiles(tilled_account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tilled_merchant_id ON public.profiles(tilled_merchant_id);

-- Add comments
COMMENT ON COLUMN public.profiles.tilled_account_id IS 'Connected account ID from Tilled /v1/accounts/connected';
COMMENT ON COLUMN public.profiles.tilled_merchant_id IS 'Onboarding application ID from Tilled /v1/onboarding'; 
COMMENT ON COLUMN public.profiles.tilled_status IS 'Last known onboarding status from Tilled';









