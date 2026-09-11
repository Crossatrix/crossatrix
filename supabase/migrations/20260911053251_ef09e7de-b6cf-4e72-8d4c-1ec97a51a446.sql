CREATE OR REPLACE FUNCTION public.pay_loan(_user uuid, _loan uuid, _amount bigint)
 RETURNS TABLE(remaining bigint, overdue bigint, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  l record;
  bal bigint;
  pay bigint;
BEGIN
  PERFORM public.loan_sweep(_user);

  SELECT * INTO l FROM public.loans ln WHERE ln.id = _loan AND ln.user_id = _user FOR UPDATE;
  IF l IS NULL THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF l.status <> 'active' THEN RAISE EXCEPTION 'Loan already paid'; END IF;
  IF _amount IS NULL OR _amount < 1 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  pay := LEAST(_amount, l.remaining);

  SELECT w.balance INTO bal FROM public.wallets w WHERE w.user_id = _user FOR UPDATE;
  IF COALESCE(bal, 0) < pay THEN
    RAISE EXCEPTION 'Insufficient balance (need %, have %)', pay, COALESCE(bal, 0);
  END IF;

  UPDATE public.wallets SET balance = balance - pay, updated_at = now() WHERE user_id = _user;
  INSERT INTO public.croin_transactions (user_id, amount, type, description)
    VALUES (_user, pay, 'debit', 'Loan repayment');
  INSERT INTO public.loan_payments (loan_id, user_id, amount, kind)
    VALUES (l.id, _user, pay, 'manual');

  UPDATE public.loans
    SET remaining = l.remaining - pay,
        overdue = GREATEST(0, l.overdue - pay),
        status = CASE WHEN l.remaining - pay <= 0 THEN 'paid' ELSE 'active' END,
        updated_at = now()
    WHERE id = l.id;

  IF NOT EXISTS (SELECT 1 FROM public.loans ln WHERE ln.user_id = _user AND ln.status = 'active' AND ln.overdue > 0) THEN
    UPDATE public.loan_penalties SET lock_level = 0, updated_at = now()
      WHERE user_id = _user AND lock_level = 2;
  END IF;

  RETURN QUERY SELECT ln.remaining, ln.overdue, ln.status FROM public.loans ln WHERE ln.id = l.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.pay_loan(uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_loan(uuid, uuid, bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.take_loan(_user uuid, _amount bigint, _schedule text)
 RETURNS TABLE(loan_id uuid, total_owed bigint, instalment bigint, next_due_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  IF _amount IS NULL OR _amount < 100 THEN
    RAISE EXCEPTION 'Minimum loan is 100 Croins';
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