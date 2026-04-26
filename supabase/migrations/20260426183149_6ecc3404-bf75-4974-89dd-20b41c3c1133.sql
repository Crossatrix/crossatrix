-- Newspaper issues table
CREATE TABLE public.newspaper_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.newspaper_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read newspaper"
ON public.newspaper_issues FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Owner can insert newspaper"
ON public.newspaper_issues FOR INSERT
TO authenticated
WITH CHECK ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can update newspaper"
ON public.newspaper_issues FOR UPDATE
TO authenticated
USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can delete newspaper"
ON public.newspaper_issues FOR DELETE
TO authenticated
USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE TRIGGER update_newspaper_issues_updated_at
BEFORE UPDATE ON public.newspaper_issues
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for newspaper assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('newspaper', 'newspaper', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read newspaper files"
ON storage.objects FOR SELECT
USING (bucket_id = 'newspaper');

CREATE POLICY "Owner can upload newspaper files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'newspaper'
  AND (auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com'
);

CREATE POLICY "Owner can update newspaper files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'newspaper'
  AND (auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com'
);

CREATE POLICY "Owner can delete newspaper files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'newspaper'
  AND (auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com'
);