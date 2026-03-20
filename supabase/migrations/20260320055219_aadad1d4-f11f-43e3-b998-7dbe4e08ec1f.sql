
CREATE OR REPLACE FUNCTION public.simulate_croin_price()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_price numeric;
  fluctuation numeric;
  new_price numeric;
BEGIN
  SELECT price INTO current_price
  FROM public.croin_price_history
  ORDER BY created_at DESC
  LIMIT 1;

  IF current_price IS NULL THEN
    current_price := 1.00;
  END IF;

  fluctuation := current_price * (random() * 0.04 - 0.02);
  new_price := ROUND((current_price + fluctuation)::numeric, 2);

  IF new_price < 0.01 THEN
    new_price := 0.01;
  END IF;

  INSERT INTO public.croin_price_history (price, changed_by)
  VALUES (new_price, '00000000-0000-0000-0000-000000000000');
END;
$$;
