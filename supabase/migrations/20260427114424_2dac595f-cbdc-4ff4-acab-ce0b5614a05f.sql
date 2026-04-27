DROP POLICY IF EXISTS "Anyone can read news" ON public.news_posts;
CREATE POLICY "Public can read news"
ON public.news_posts
FOR SELECT
TO anon, authenticated
USING (true);