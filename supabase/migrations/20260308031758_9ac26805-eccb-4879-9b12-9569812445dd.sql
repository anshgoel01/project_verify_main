
-- Create reports table
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  coursera_link text NOT NULL,
  linkedin_link text NOT NULL,
  project_link text,
  description text NOT NULL,
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for report screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('report-images', 'report-images', true);

CREATE POLICY "Authenticated users can upload report images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'report-images');

CREATE POLICY "Anyone can view report images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'report-images');
