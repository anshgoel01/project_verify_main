-- Fix Admin Dashboard daily submissions chart to group by local timezone (IST)
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_students INT;
  total_subs INT;
  level_counts JSON;
  daily_counts JSON;
BEGIN
  -- Count total students
  SELECT COUNT(*) INTO total_students FROM public.profiles;
  
  -- Count total submissions
  SELECT COALESCE(SUM(total_submissions), 0) INTO total_subs FROM public.profiles;

  -- Get level distribution for correct submissions
  SELECT json_object_agg(level, count) INTO level_counts
  FROM (
    SELECT COALESCE(level, 'Beginner') as level, COUNT(*) as count
    FROM public.submissions
    WHERE status = 'correct'
    GROUP BY COALESCE(level, 'Beginner')
  ) t;

  -- Get daily counts for last 14 days (Shifted to Indian Standard Time)
  SELECT json_agg(row_to_json(d)) INTO daily_counts
  FROM (
    SELECT DATE(created_at AT TIME ZONE 'Asia/Kolkata') as date, COUNT(*) as count
    FROM public.submissions
    WHERE status = 'correct' 
      AND created_at >= NOW() - INTERVAL '14 days'
    GROUP BY DATE(created_at AT TIME ZONE 'Asia/Kolkata')
    ORDER BY DATE(created_at AT TIME ZONE 'Asia/Kolkata') ASC
  ) d;

  RETURN json_build_object(
    'totalStudents', total_students,
    'totalSubmissions', total_subs,
    'levelCounts', COALESCE(level_counts, '{}'::json),
    'dailyCounts', COALESCE(daily_counts, '[]'::json)
  );
END;
$$;
