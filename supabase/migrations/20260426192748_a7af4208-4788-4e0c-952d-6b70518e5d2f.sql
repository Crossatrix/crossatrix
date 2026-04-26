-- Apps that can be reported on
CREATE TABLE public.bug_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  versions text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read bug apps"
  ON public.bug_apps FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner can insert bug apps"
  ON public.bug_apps FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can update bug apps"
  ON public.bug_apps FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can delete bug apps"
  ON public.bug_apps FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE TRIGGER update_bug_apps_updated_at
  BEFORE UPDATE ON public.bug_apps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bug reports submitted by users
CREATE TABLE public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  app text NOT NULL,
  app_version text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bug reports"
  ON public.bug_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Users can insert own bug reports"
  ON public.bug_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update bug reports"
  ON public.bug_reports FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can delete bug reports"
  ON public.bug_reports FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE TRIGGER update_bug_reports_updated_at
  BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();