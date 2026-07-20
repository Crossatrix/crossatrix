
CREATE TABLE public.user_loginnames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL UNIQUE,
  slot_index int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.user_loginnames(user_id);
CREATE INDEX ON public.user_loginnames(lower(name));

GRANT SELECT, DELETE ON public.user_loginnames TO authenticated;
GRANT ALL ON public.user_loginnames TO service_role;

ALTER TABLE public.user_loginnames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own loginnames" ON public.user_loginnames
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own loginnames" ON public.user_loginnames
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.purchase_loginname(_user uuid, _name text)
RETURNS TABLE(id uuid, name text, slot_index int, cost bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  existing_count int;
  next_slot int;
  price bigint;
  bal bigint;
  new_id uuid;
  cleaned text;
BEGIN
  cleaned := lower(trim(_name));
  IF cleaned IS NULL OR length(cleaned) < 3 OR length(cleaned) > 32 THEN
    RAISE EXCEPTION 'Loginname must be 3-32 characters';
  END IF;
  IF cleaned !~ '^[a-z0-9_.-]+$' THEN
    RAISE EXCEPTION 'Loginname may only contain letters, digits, dot, dash, underscore';
  END IF;
  IF position('@' in cleaned) > 0 THEN
    RAISE EXCEPTION 'Loginname cannot contain @';
  END IF;

  SELECT COUNT(*) INTO existing_count FROM public.user_loginnames WHERE user_id = _user;
  IF existing_count >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 loginnames reached';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_loginnames WHERE lower(name) = cleaned) THEN
    RAISE EXCEPTION 'Loginname already taken';
  END IF;

  next_slot := existing_count + 1;
  price := CASE WHEN next_slot = 1 THEN 0 ELSE 50 END;

  IF price > 0 THEN
    SELECT balance INTO bal FROM public.wallets WHERE user_id = _user FOR UPDATE;
    IF bal IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    IF bal < price THEN RAISE EXCEPTION 'Insufficient balance (need %, have %)', price, bal; END IF;
    UPDATE public.wallets SET balance = balance - price, updated_at = now() WHERE user_id = _user;
    INSERT INTO public.croin_transactions (user_id, amount, type, description)
      VALUES (_user, price, 'debit', format('Purchased loginname "%s"', cleaned));
  END IF;

  INSERT INTO public.user_loginnames (user_id, name, slot_index)
    VALUES (_user, cleaned, next_slot)
    RETURNING user_loginnames.id INTO new_id;

  RETURN QUERY SELECT new_id, cleaned, next_slot, price;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_loginname_to_user(_name text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.user_loginnames WHERE lower(name) = lower(trim(_name)) LIMIT 1
$$;
