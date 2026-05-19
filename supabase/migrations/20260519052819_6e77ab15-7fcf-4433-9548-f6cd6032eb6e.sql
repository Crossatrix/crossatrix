
-- 1. Wallets: remove client UPDATE policy. Balance changes via edge functions only.
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;

-- 2. croin_codes: restrict SELECT to admins only.
DROP POLICY IF EXISTS "Anyone authenticated can read codes" ON public.croin_codes;
CREATE POLICY "Admins read codes"
  ON public.croin_codes FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com','moritz.loeseke7@gmail.com'));

-- 3. Explicit deny policies (no policy already denies; these document intent and silence scanner).
CREATE POLICY "Deny client inserts" ON public.croin_transactions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client updates" ON public.croin_transactions FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny client deletes" ON public.croin_transactions FOR DELETE TO authenticated USING (false);

CREATE POLICY "Deny client inserts" ON public.referrals FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client updates" ON public.referrals FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny client deletes" ON public.referrals FOR DELETE TO authenticated USING (false);

CREATE POLICY "Deny client reads" ON public.user_2fa_challenges FOR SELECT TO authenticated USING (false);
CREATE POLICY "Deny client inserts" ON public.user_2fa_challenges FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client updates" ON public.user_2fa_challenges FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny client deletes" ON public.user_2fa_challenges FOR DELETE TO authenticated USING (false);

CREATE POLICY "Deny client inserts" ON public.croin_code_redemptions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client updates" ON public.croin_code_redemptions FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny client deletes" ON public.croin_code_redemptions FOR DELETE TO authenticated USING (false);

CREATE POLICY "Deny client inserts" ON public.croin_price_history FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client updates" ON public.croin_price_history FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny client deletes" ON public.croin_price_history FOR DELETE TO authenticated USING (false);

-- 4. Revoke EXECUTE on simulate_croin_price from anon/authenticated; only service_role may call.
REVOKE EXECUTE ON FUNCTION public.simulate_croin_price() FROM PUBLIC, anon, authenticated;

-- 5. Atomic transfer function to prevent double-spend race conditions.
CREATE OR REPLACE FUNCTION public.transfer_croins(
  _sender uuid,
  _recipient uuid,
  _amount bigint,
  _sender_desc text,
  _recipient_desc text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_balance bigint;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF _sender = _recipient THEN
    RAISE EXCEPTION 'Cannot send to self';
  END IF;

  -- Lock sender wallet row
  SELECT balance INTO sender_balance
  FROM public.wallets WHERE user_id = _sender FOR UPDATE;

  IF sender_balance IS NULL THEN
    RAISE EXCEPTION 'Sender wallet not found';
  END IF;
  IF sender_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.wallets
    SET balance = balance - _amount, updated_at = now()
    WHERE user_id = _sender;

  -- Ensure recipient wallet exists, then credit
  INSERT INTO public.wallets (user_id, balance)
    VALUES (_recipient, _amount)
    ON CONFLICT (user_id)
    DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

  INSERT INTO public.croin_transactions (user_id, amount, type, description)
    VALUES (_sender, _amount, 'debit', _sender_desc),
           (_recipient, _amount, 'credit', _recipient_desc);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transfer_croins(uuid, uuid, bigint, text, text) FROM PUBLIC, anon, authenticated;
