-- Add linkedin_url column to profiles table (nullable for existing users)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
