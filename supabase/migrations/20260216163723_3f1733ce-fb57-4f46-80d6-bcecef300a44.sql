CREATE POLICY "Users can delete their own submissions"
ON public.submissions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
