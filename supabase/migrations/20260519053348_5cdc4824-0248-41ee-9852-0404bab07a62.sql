
-- Allow users to read codes they created themselves (admins still see all via existing policy).
CREATE POLICY "Users read own codes"
  ON public.croin_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

-- Atomic purchase: validate, debit buyer, create code, log transaction.
CREATE OR REPLACE FUNCTION public.purchase_croin_code(
  _buyer uuid,
  _code text,
  _amount integer,
  _max_uses integer
)
RETURNS TABLE (id uuid, code text, amount integer, max_uses integer, cost bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  buyer_balance bigint;
  total_cost bigint;
  new_id uuid;
BEGIN
  IF _amount IS NULL OR _amount < 1 OR _amount > 1000 THEN
    RAISE EXCEPTION 'Amount must be between 1 and 1000';
  END IF;
  IF _max_uses IS NULL OR _max_uses < 1 OR _max_uses > 100 THEN
    RAISE EXCEPTION 'Max uses must be between 1 and 100';
  END IF;
  IF _code !~ '^[a-z0-9]{4}-[a-z0-9]{4}--[a-z0-9]{4}-[a-z0-9]{4}$' THEN
    RAISE EXCEPTION 'Invalid code format';
  END IF;

  -- cost = ceil(amount * max_uses * 1.05)
  total_cost := CEIL((_amount::numeric * _max_uses::numeric) * 1.05)::bigint;

  -- Lock buyer wallet
  SELECT balance INTO buyer_balance
  FROM public.wallets WHERE user_id = _buyer FOR UPDATE;

  IF buyer_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;
  IF buyer_balance < total_cost THEN
    RAISE EXCEPTION 'Insufficient balance (need %, have %)', total_cost, buyer_balance;
  END IF;

  IF EXISTS (SELECT 1 FROM public.croin_codes WHERE code = _code) THEN
    RAISE EXCEPTION 'Code already exists';
  END IF;

  UPDATE public.wallets
    SET balance = balance - total_cost, updated_at = now()
    WHERE user_id = _buyer;

  INSERT INTO public.croin_codes (code, amount, max_uses, created_by, active)
    VALUES (_code, _amount, _max_uses, _buyer, true)
    RETURNING croin_codes.id INTO new_id;

  INSERT INTO public.croin_transactions (user_id, amount, type, description)
    VALUES (_buyer, total_cost, 'debit',
            format('Purchased code %s (%s¢ × %s uses)', _code, _amount, _max_uses));

  RETURN QUERY SELECT new_id, _code, _amount, _max_uses, total_cost;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_croin_code(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
