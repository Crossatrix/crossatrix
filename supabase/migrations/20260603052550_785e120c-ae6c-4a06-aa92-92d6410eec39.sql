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
  IF _quantity IS NULL OR _quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;
  IF _type NOT IN ('buy','sell') THEN
    RAISE EXCEPTION 'Invalid type';
  END IF;

  SELECT s.price INTO cur_price FROM public.shares s WHERE s.id = _share_id FOR UPDATE;
  IF cur_price IS NULL THEN RAISE EXCEPTION 'Share not found'; END IF;

  SELECT cph.price INTO croin_price
  FROM public.croin_price_history cph
  ORDER BY cph.created_at DESC
  LIMIT 1;
  IF croin_price IS NULL OR croin_price <= 0 THEN croin_price := 1.00; END IF;

  total_cost := CEIL(cur_price * _quantity * croin_price)::bigint;

  SELECT COALESCE(h.quantity, 0) INTO cur_qty
  FROM public.share_holdings h WHERE h.user_id = _user AND h.share_id = _share_id FOR UPDATE;
  cur_qty := COALESCE(cur_qty, 0);

  IF _type = 'buy' THEN
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
    SELECT COALESCE((SELECT sh.quantity FROM public.share_holdings sh WHERE sh.user_id = _user AND sh.share_id = _share_id), 0),
           cur_price, total_cost;
END;
$function$;