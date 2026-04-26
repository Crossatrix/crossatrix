CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.owner_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Link',
  kind TEXT NOT NULL DEFAULT 'website',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read owner links"
ON public.owner_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner can insert links"
ON public.owner_links FOR INSERT TO authenticated
WITH CHECK ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can update links"
ON public.owner_links FOR UPDATE TO authenticated
USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can delete links"
ON public.owner_links FOR DELETE TO authenticated
USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'cross.a.trix.owner@hotmail.com');

CREATE TRIGGER update_owner_links_updated_at
BEFORE UPDATE ON public.owner_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();