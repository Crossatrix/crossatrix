-- owner_links: replace policies
DROP POLICY IF EXISTS "Owner can insert links" ON public.owner_links;
DROP POLICY IF EXISTS "Owner can update links" ON public.owner_links;
DROP POLICY IF EXISTS "Owner can delete links" ON public.owner_links;

CREATE POLICY "Owner can insert links"
ON public.owner_links FOR INSERT TO authenticated
WITH CHECK ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can update links"
ON public.owner_links FOR UPDATE TO authenticated
USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can delete links"
ON public.owner_links FOR DELETE TO authenticated
USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

-- news_posts: replace policies
DROP POLICY IF EXISTS "Owner can insert news" ON public.news_posts;
DROP POLICY IF EXISTS "Owner can update news" ON public.news_posts;
DROP POLICY IF EXISTS "Owner can delete news" ON public.news_posts;

CREATE POLICY "Owner can insert news"
ON public.news_posts FOR INSERT TO authenticated
WITH CHECK ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can update news"
ON public.news_posts FOR UPDATE TO authenticated
USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can delete news"
ON public.news_posts FOR DELETE TO authenticated
USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');