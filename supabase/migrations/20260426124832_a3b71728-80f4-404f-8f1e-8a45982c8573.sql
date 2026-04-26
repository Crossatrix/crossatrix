CREATE TABLE public.news_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read news"
ON public.news_posts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner can insert news"
ON public.news_posts FOR INSERT TO authenticated
WITH CHECK ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can update news"
ON public.news_posts FOR UPDATE TO authenticated
USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can delete news"
ON public.news_posts FOR DELETE TO authenticated
USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'cross.a.trix.owner@hotmail.com');

CREATE TRIGGER update_news_posts_updated_at
BEFORE UPDATE ON public.news_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();