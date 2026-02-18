-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram index for college name search
CREATE INDEX idx_colleges_name_trgm ON public.colleges USING gin (lower(name) gin_trgm_ops);
