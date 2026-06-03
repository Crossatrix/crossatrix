ALTER TABLE public.share_holdings
  DROP CONSTRAINT IF EXISTS share_holdings_quantity_check;

ALTER TABLE public.share_holdings
  ADD CONSTRAINT share_holdings_quantity_check CHECK (quantity >= 0);

DROP POLICY IF EXISTS "Owners can insert newspaper" ON public.newspaper_issues;
DROP POLICY IF EXISTS "Owners can update newspaper" ON public.newspaper_issues;
DROP POLICY IF EXISTS "Owners can delete newspaper" ON public.newspaper_issues;
DROP POLICY IF EXISTS "Owner can insert newspaper" ON public.newspaper_issues;
DROP POLICY IF EXISTS "Owner can update newspaper" ON public.newspaper_issues;
DROP POLICY IF EXISTS "Owner can delete newspaper" ON public.newspaper_issues;

CREATE POLICY "Owners can insert newspaper"
ON public.newspaper_issues
FOR INSERT
TO authenticated
WITH CHECK ((auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com', 'moritz.loeseke7@gmail.com'));

CREATE POLICY "Owners can update newspaper"
ON public.newspaper_issues
FOR UPDATE
TO authenticated
USING ((auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com', 'moritz.loeseke7@gmail.com'));

CREATE POLICY "Owners can delete newspaper"
ON public.newspaper_issues
FOR DELETE
TO authenticated
USING ((auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com', 'moritz.loeseke7@gmail.com'));

DROP POLICY IF EXISTS "Owner can upload newspaper files" ON storage.objects;
DROP POLICY IF EXISTS "Owner can update newspaper files" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete newspaper files" ON storage.objects;

CREATE POLICY "Owners can upload newspaper files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'newspaper'
  AND (auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com', 'moritz.loeseke7@gmail.com')
);

CREATE POLICY "Owners can update newspaper files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'newspaper'
  AND (auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com', 'moritz.loeseke7@gmail.com')
);

CREATE POLICY "Owners can delete newspaper files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'newspaper'
  AND (auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com', 'moritz.loeseke7@gmail.com')
);