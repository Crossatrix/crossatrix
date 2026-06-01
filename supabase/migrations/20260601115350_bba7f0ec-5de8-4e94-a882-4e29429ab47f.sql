-- 1. Categories table
CREATE TABLE public.share_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id uuid NOT NULL REFERENCES public.shares(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#22d3ee',
  amount numeric NOT NULL DEFAULT 0,
  threshold numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_categories_share_id ON public.share_categories(share_id);

GRANT SELECT ON public.share_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_categories TO authenticated;
GRANT ALL ON public.share_categories TO service_role;

ALTER TABLE public.share_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read share categories"
ON public.share_categories FOR SELECT
USING (true);

CREATE POLICY "Owner can insert share categories"
ON public.share_categories FOR INSERT TO authenticated
WITH CHECK ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can update share categories"
ON public.share_categories FOR UPDATE TO authenticated
USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE POLICY "Owner can delete share categories"
ON public.share_categories FOR DELETE TO authenticated
USING ((auth.jwt() ->> 'email') = 'cross.a.trix.owner@hotmail.com');

CREATE TRIGGER update_share_categories_updated_at
BEFORE UPDATE ON public.share_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Recompute share price from its categories
CREATE OR REPLACE FUNCTION public.recompute_share_price(_share_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_count integer;
  new_price numeric;
BEGIN
  SELECT COUNT(*) INTO cat_count FROM public.share_categories WHERE share_id = _share_id;
  IF cat_count = 0 THEN
    RETURN; -- no categories: leave the manually set price untouched
  END IF;

  SELECT COALESCE(SUM(CASE WHEN threshold > 0 THEN amount / threshold ELSE 0 END), 0)
    INTO new_price
  FROM public.share_categories
  WHERE share_id = _share_id;

  new_price := ROUND(new_price, 2);
  IF new_price < 0 THEN new_price := 0; END IF;

  UPDATE public.shares SET price = new_price, updated_at = now() WHERE id = _share_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.share_categories_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_share_price(OLD.share_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_share_price(NEW.share_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_share_categories_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.share_categories
FOR EACH ROW EXECUTE FUNCTION public.share_categories_recompute();

-- 3. Trading multiplies cost/proceeds by the current Croin price
CREATE OR REPLACE FUNCTION public.trade_share(_user uuid, _share_id uuid, _quantity integer, _type text)
 RETURNS TABLE(new_quantity integer, price numeric, total bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cur_price numeric;
  croin_price numeric;
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

  SELECT price INTO croin_price
  FROM public.croin_price_history
  ORDER BY created_at DESC
  LIMIT 1;
  IF croin_price IS NULL OR croin_price <= 0 THEN croin_price := 1.00; END IF;

  total_cost := CEIL(cur_price * _quantity * croin_price)::bigint;

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
$function$;