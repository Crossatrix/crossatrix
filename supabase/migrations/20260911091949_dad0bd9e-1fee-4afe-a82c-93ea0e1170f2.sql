CREATE OR REPLACE FUNCTION public.take_loan(_user uuid, _amount bigint, _schedule text)
RETURNS TABLE(loan_id uuid, total_owed bigint, instalment bigint, next_due_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  active_count integer;
  outstanding bigint;
  total bigint;
  inst bigint;
  due timestamptz;
  new_id uuid;
  lvl integer;
  account_created timestamptz;
BEGIN
  IF _schedule NOT IN ('week','month') THEN
    RAISE EXCEPTION 'Schedule must be week or month';
  END IF;
  IF _amount IS NULL OR _amount < 10 THEN
    RAISE EXCEPTION 'Minimum loan is 10 Croins';
  END IF;

  SELECT u.created_at INTO account_created FROM auth.users u WHERE u.id = _user;
  IF account_created IS NULL OR account_created > now() - interval '7 days' THEN
    RAISE EXCEPTION 'Your account must be at least 7 days old to take a loan';
  END IF;

  PERFORM public.loan_sweep(_user);

  SELECT COALESCE(lp.lock_level, 0) INTO lvl FROM public.loan_penalties lp WHERE lp.user_id = _user;
  IF COALESCE(lvl, 0) >= 2 THEN
    RAISE EXCEPTION 'Account restricted due to missed loan payments';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(ln.remaining), 0) INTO active_count, outstanding
    FROM public.loans ln WHERE ln.user_id = _user AND ln.status = 'active';

  IF active_count >= 3 THEN
    RAISE EXCEPTION 'You can have at most 3 active loans';
  END IF;

  total := CEIL(_amount * 1.05)::bigint;
  IF outstanding + total > 30000 THEN
    RAISE EXCEPTION 'Total debt would exceed 30000 Croins (current %, requested %)', outstanding, total;
  END IF;

  inst := GREATEST(1, CEIL(total * (CASE WHEN _schedule = 'week' THEN 0.02 ELSE 0.05 END))::bigint);
  due := now() + (CASE WHEN _schedule = 'week' THEN interval '7 days' ELSE interval '1 month' END);

  INSERT INTO public.loans (user_id, principal, total_owed, remaining, schedule, instalment, next_due_at)
    VALUES (_user, _amount, total, total, _schedule, inst, due)
    RETURNING id INTO new_id;

  INSERT INTO public.wallets (user_id, balance) VALUES (_user, _amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
  INSERT INTO public.croin_transactions (user_id, amount, type, description)
    VALUES (_user, _amount, 'credit', format('Loan payout (owe %s)', total));

  RETURN QUERY SELECT new_id, total, inst, due;
END;
$function$;

REVOKE ALL ON FUNCTION public.take_loan(uuid, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_loan(uuid, bigint, text) TO service_role;