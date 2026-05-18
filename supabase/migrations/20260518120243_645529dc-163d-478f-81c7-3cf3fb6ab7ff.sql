
CREATE TABLE public.croin_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount integer NOT NULL CHECK (amount > 0),
  max_uses integer NOT NULL CHECK (max_uses > 0),
  uses integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.croin_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read codes"
  ON public.croin_codes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert codes"
  ON public.croin_codes FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com','moritz.loeseke7@gmail.com'));

CREATE POLICY "Admins update codes"
  ON public.croin_codes FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com','moritz.loeseke7@gmail.com'));

CREATE POLICY "Admins delete codes"
  ON public.croin_codes FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com','moritz.loeseke7@gmail.com'));

CREATE TRIGGER trg_croin_codes_updated
  BEFORE UPDATE ON public.croin_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.croin_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.croin_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code_id, user_id)
);

ALTER TABLE public.croin_code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own redemptions"
  ON public.croin_code_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com','moritz.loeseke7@gmail.com'));
