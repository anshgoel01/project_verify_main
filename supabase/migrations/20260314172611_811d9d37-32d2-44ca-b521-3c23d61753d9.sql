
CREATE TABLE public.default_weights (
  level text PRIMARY KEY,
  weight numeric NOT NULL DEFAULT 0.25,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.default_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Level weights viewable by everyone" ON public.default_weights FOR SELECT USING (true);
INSERT INTO public.default_weights (level, weight) VALUES
  ('Beginner', 0.25), ('Intermediate', 0.50), ('Advanced', 0.75), ('Mixed', 0.60);