
CREATE TABLE public.user_2fa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  method text CHECK (method IN ('email','sms','file','face')),
  phone text,
  secret_key text,
  face_descriptor jsonb,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_2fa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own 2fa" ON public.user_2fa FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own 2fa" ON public.user_2fa FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own 2fa" ON public.user_2fa FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own 2fa" ON public.user_2fa FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_2fa_updated BEFORE UPDATE ON public.user_2fa
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_2fa_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  method text NOT NULL,
  code_hash text,
  purpose text NOT NULL DEFAULT 'login',
  expires_at timestamptz NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_2fa_challenges ENABLE ROW LEVEL SECURITY;
-- No policies: only service role accesses this table.

CREATE INDEX idx_user_2fa_challenges_user ON public.user_2fa_challenges(user_id, created_at DESC);
