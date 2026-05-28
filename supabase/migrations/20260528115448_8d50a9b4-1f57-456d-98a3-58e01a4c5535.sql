-- shares table
CREATE TABLE public.shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL UNIQUE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 1.00 CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shares TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shares TO authenticated;
GRANT ALL ON public.shares TO service_role;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shares" ON public.shares FOR SELECT USING (true);
CREATE POLICY "Owner can insert shares" ON public.shares FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');
CREATE POLICY "Owner can update shares" ON public.shares FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');
CREATE POLICY "Owner can delete shares" ON public.shares FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE TRIGGER update_shares_updated_at BEFORE UPDATE ON public.shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- share_holdings
CREATE TABLE public.share_holdings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  share_id uuid NOT NULL REFERENCES public.shares(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0 AND quantity <= 1000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, share_id)
);
GRANT SELECT ON public.share_holdings TO authenticated;
GRANT ALL ON public.share_holdings TO service_role;
ALTER TABLE public.share_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own holdings" ON public.share_holdings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Deny client writes holdings ins" ON public.share_holdings FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client writes holdings upd" ON public.share_holdings FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny client writes holdings del" ON public.share_holdings FOR DELETE TO authenticated USING (false);

-- share_transactions
CREATE TABLE public.share_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  share_id uuid NOT NULL REFERENCES public.shares(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('buy','sell')),
  quantity integer NOT NULL CHECK (quantity > 0),
  price_at_tx numeric NOT NULL,
  total bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.share_transactions TO authenticated;
GRANT ALL ON public.share_transactions TO service_role;
ALTER TABLE public.share_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own share tx" ON public.share_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Deny client writes shtx ins" ON public.share_transactions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client writes shtx upd" ON public.share_transactions FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny client writes shtx del" ON public.share_transactions FOR DELETE TO authenticated USING (false);

-- trade function
CREATE OR REPLACE FUNCTION public.trade_share(_user uuid, _share_id uuid, _quantity integer, _type text)
RETURNS TABLE (new_quantity integer, price numeric, total bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_price numeric;
  cur_qty integer;
  total_cost bigint;
  wallet_bal bigint;
BEGIN
  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 1000 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 1000';
  END IF;
  IF _type NOT IN ('buy','sell') THEN
    RAISE EXCEPTION 'Invalid type';
  END IF;

  SELECT s.price INTO cur_price FROM public.shares s WHERE s.id = _share_id FOR UPDATE;
  IF cur_price IS NULL THEN RAISE EXCEPTION 'Share not found'; END IF;

  total_cost := CEIL(cur_price * _quantity)::bigint;

  SELECT COALESCE(h.quantity, 0) INTO cur_qty
  FROM public.share_holdings h WHERE h.user_id = _user AND h.share_id = _share_id FOR UPDATE;
  cur_qty := COALESCE(cur_qty, 0);

  IF _type = 'buy' THEN
    IF cur_qty + _quantity > 1000 THEN
      RAISE EXCEPTION 'Holding cap reached (max 1000 per share)';
    END IF;
    SELECT balance INTO wallet_bal FROM public.wallets WHERE user_id = _user FOR UPDATE;
    IF wallet_bal IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    IF wallet_bal < total_cost THEN RAISE EXCEPTION 'Insufficient balance (need %, have %)', total_cost, wallet_bal; END IF;

    UPDATE public.wallets SET balance = balance - total_cost, updated_at = now() WHERE user_id = _user;
    INSERT INTO public.share_holdings (user_id, share_id, quantity)
      VALUES (_user, _share_id, _quantity)
      ON CONFLICT (user_id, share_id)
      DO UPDATE SET quantity = public.share_holdings.quantity + EXCLUDED.quantity, updated_at = now();
    INSERT INTO public.croin_transactions (user_id, amount, type, description)
      VALUES (_user, total_cost, 'debit', format('Bought %s share(s) @ ¢%s', _quantity, cur_price));
  ELSE
    IF cur_qty < _quantity THEN RAISE EXCEPTION 'Not enough shares to sell'; END IF;
    UPDATE public.share_holdings SET quantity = quantity - _quantity, updated_at = now()
      WHERE user_id = _user AND share_id = _share_id;
    INSERT INTO public.wallets (user_id, balance) VALUES (_user, total_cost)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
    INSERT INTO public.croin_transactions (user_id, amount, type, description)
      VALUES (_user, total_cost, 'credit', format('Sold %s share(s) @ ¢%s', _quantity, cur_price));
  END IF;

  INSERT INTO public.share_transactions (user_id, share_id, type, quantity, price_at_tx, total)
    VALUES (_user, _share_id, _type, _quantity, cur_price, total_cost);

  RETURN QUERY
    SELECT COALESCE((SELECT quantity FROM public.share_holdings WHERE user_id = _user AND share_id = _share_id), 0),
           cur_price, total_cost;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trade_share(uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;