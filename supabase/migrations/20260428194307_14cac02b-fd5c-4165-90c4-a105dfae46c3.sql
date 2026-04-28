CREATE TABLE public.info_page (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE DEFAULT 'main',
  title text NOT NULL DEFAULT 'About Crossatrix',
  content text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.info_page ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read info" ON public.info_page
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Owner can insert info" ON public.info_page
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can update info" ON public.info_page
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can delete info" ON public.info_page
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE TRIGGER update_info_page_updated_at
BEFORE UPDATE ON public.info_page
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.info_page (slug, title, content)
VALUES ('main', 'About Crossatrix', 'Welcome to Crossatrix — the central hub for the Cross-ecosystem.')
ON CONFLICT (slug) DO NOTHING;