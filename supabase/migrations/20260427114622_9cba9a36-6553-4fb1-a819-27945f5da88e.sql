DROP POLICY IF EXISTS "Anyone can read newspaper" ON public.newspaper_issues;
CREATE POLICY "Public can read newspaper"
ON public.newspaper_issues
FOR SELECT
TO anon, authenticated
USING (true);