-- Lock profile updates so authenticated users can only change editable fields.
-- This prevents clients from patching score or submission counters directly.

BEGIN;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, roll_no, linkedin_url) ON public.profiles TO authenticated;

COMMIT;
