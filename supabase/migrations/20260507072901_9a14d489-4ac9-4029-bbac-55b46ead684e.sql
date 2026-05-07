DROP POLICY IF EXISTS "Owner can insert newspaper" ON public.newspaper_issues;
DROP POLICY IF EXISTS "Owner can update newspaper" ON public.newspaper_issues;
DROP POLICY IF EXISTS "Owner can delete newspaper" ON public.newspaper_issues;

CREATE POLICY "Owners can insert newspaper" ON public.newspaper_issues
FOR INSERT TO authenticated
WITH CHECK ((auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com','moritz.loeseke@gmail.com'));

CREATE POLICY "Owners can update newspaper" ON public.newspaper_issues
FOR UPDATE TO authenticated
USING ((auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com','moritz.loeseke@gmail.com'));

CREATE POLICY "Owners can delete newspaper" ON public.newspaper_issues
FOR DELETE TO authenticated
USING ((auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com','moritz.loeseke@gmail.com'));