-- ============================================================
-- Clean up all non-correct submissions that should not be stored.
-- Only 'correct' submissions should ever be persisted.
-- Deleting these rows triggers update_profile_stats() which
-- recalculates total_submissions, correct_submissions, and score
-- for each affected user automatically.
-- ============================================================

DELETE FROM public.submissions
WHERE status IN ('wrong', 'failed', 'skipped', 'processing');
