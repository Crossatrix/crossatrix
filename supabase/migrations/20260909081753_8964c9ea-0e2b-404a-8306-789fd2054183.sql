
CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  principal bigint NOT NULL,
  total_owed bigint NOT NULL,
  remaining bigint NOT NULL,
  overdue bigint NOT NULL DEFAULT 0,
  schedule text NOT NULL CHECK (schedule IN ('week','month')),
  instalment bigint NOT NULL,
  next_due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loans_select_own" ON public.loans FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_email());

CREATE TABLE public.loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount bigint NOT NULL,
  kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','auto')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loan_payments TO authenticated;
GRANT ALL ON public.loan_payments TO service_role;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_payments_select_own" ON public.loan_payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_email());

CREATE TABLE public.loan_penalties (
  user_id uuid PRIMARY KEY,
  misses integer NOT NULL DEFAULT 0,
  lock_level integer NOT NULL DEFAULT 0,
  last_miss_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loan_penalties TO authenticated;
GRANT ALL ON public.loan_penalties TO service_role;
ALTER TABLE public.loan_penalties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_penalties_select_own" ON public.loan_penalties FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_email());

CREATE TABLE public.loan_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loan_appeals TO authenticated;
GRANT ALL ON public.loan_appeals TO service_role;
ALTER TABLE public.loan_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_appeals_select_own" ON public.loan_appeals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_email());

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_loan_penalties_updated_at BEFORE UPDATE ON public.loan_penalties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_loan_appeals_updated_at BEFORE UPDATE ON public.loan_appeals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Escalates a missed payment for a user.
CREATE OR REPLACE FUNCTION public.loan_register_miss(_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m integer;
BEGIN
  INSERT INTO public.loan_penalties (user_id, misses, lock_level, last_miss_at)
  VALUES (_user, 1, 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET misses = public.loan_penalties.misses + 1,
        lock_level = LEAST(public.loan_penalties.misses + 1, 3),
        last_miss_at = now(),
        updated_at = now()
  RETURNING misses INTO m;

  IF m >= 3 THEN
    INSERT INTO public.account_lockdowns (user_id, locked, locked_at)
    VALUES (_user, true, now())
    ON CONFLICT (user_id) DO UPDATE SET locked = true, locked_at = now(), updated_at = now();
  END IF;
END;
$$;

-- Processes all due instalments for a user: auto-charges the wallet when possible,
-- otherwise records a miss and escalates.
CREATE OR REPLACE FUNCTION public.loan_sweep(_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l record;
  due bigint;
  bal bigint;
  guard integer;
BEGIN
  FOR l IN SELECT * FROM public.loans WHERE user_id = _user AND status = 'active' FOR UPDATE LOOP
    guard := 0;
    WHILE l.next_due_at <= now() AND l.remaining > 0 AND guard < 60 LOOP
      guard := guard + 1;
      due := LEAST(l.instalment + l.overdue, l.remaining);

      SELECT balance INTO bal FROM public.wallets WHERE user_id = _user FOR UPDATE;
      bal := COALESCE(bal, 0);

      IF bal >= due AND due > 0 THEN
        UPDATE public.wallets SET balance = balance - due, updated_at = now() WHERE user_id = _user;
        INSERT INTO public.croin_transactions (user_id, amount, type, description)
          VALUES (_user, due, 'debit', 'Loan repayment (automatic)');
        INSERT INTO public.loan_payments (loan_id, user_id, amount, kind)
          VALUES (l.id, _user, due, 'auto');
        l.remaining := l.remaining - due;
        l.overdue := 0;
      ELSE
        l.overdue := l.overdue + LEAST(l.instalment, l.remaining);
        PERFORM public.loan_register_miss(_user);
      END IF;

      l.next_due_at := l.next_due_at + (CASE WHEN l.schedule = 'week' THEN interval '7 days' ELSE interval '1 month' END);
    END LOOP;

    UPDATE public.loans
      SET remaining = l.remaining,
          overdue = l.overdue,
          next_due_at = l.next_due_at,
          status = CASE WHEN l.remaining <= 0 THEN 'paid' ELSE 'active' END,
          updated_at = now()
      WHERE id = l.id;
  END LOOP;

  -- Clear a level-2 lock once nothing is overdue anymore.
  IF NOT EXISTS (SELECT 1 FROM public.loans WHERE user_id = _user AND status = 'active' AND overdue > 0) THEN
    UPDATE public.loan_penalties SET lock_level = 0, updated_at = now()
      WHERE user_id = _user AND lock_level = 2;
  END IF;
END;
$$;

-- Takes out a new loan.
CREATE OR REPLACE FUNCTION public.take_loan(_user uuid, _amount bigint, _schedule text)
RETURNS TABLE(loan_id uuid, total_owed bigint, instalment bigint, next_due_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  active_count integer;
  outstanding bigint;
  total bigint;
  inst bigint;
  due timestamptz;
  new_id uuid;
  lvl integer;
BEGIN
  IF _schedule NOT IN ('week','month') THEN
    RAISE EXCEPTION 'Schedule must be week or month';
  END IF;
  IF _amount IS NULL OR _amount < 10 THEN
    RAISE EXCEPTION 'Minimum loan is 10 Croins';
  END IF;

  PERFORM public.loan_sweep(_user);

  SELECT COALESCE(lock_level, 0) INTO lvl FROM public.loan_penalties WHERE user_id = _user;
  IF COALESCE(lvl, 0) >= 2 THEN
    RAISE EXCEPTION 'Account restricted due to missed loan payments';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(remaining), 0) INTO active_count, outstanding
    FROM public.loans WHERE user_id = _user AND status = 'active';

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
$$;

-- Manual repayment towards a loan.
CREATE OR REPLACE FUNCTION public.pay_loan(_user uuid, _loan uuid, _amount bigint)
RETURNS TABLE(remaining bigint, overdue bigint, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l record;
  bal bigint;
  pay bigint;
BEGIN
  PERFORM public.loan_sweep(_user);

  SELECT * INTO l FROM public.loans WHERE id = _loan AND user_id = _user FOR UPDATE;
  IF l IS NULL THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF l.status <> 'active' THEN RAISE EXCEPTION 'Loan already paid'; END IF;
  IF _amount IS NULL OR _amount < 1 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  pay := LEAST(_amount, l.remaining);

  SELECT balance INTO bal FROM public.wallets WHERE user_id = _user FOR UPDATE;
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

  IF NOT EXISTS (SELECT 1 FROM public.loans WHERE user_id = _user AND status = 'active' AND overdue > 0) THEN
    UPDATE public.loan_penalties SET lock_level = 0, updated_at = now()
      WHERE user_id = _user AND lock_level = 2;
  END IF;

  RETURN QUERY SELECT ln.remaining, ln.overdue, ln.status FROM public.loans ln WHERE ln.id = l.id;
END;
$$;

-- Current loan lock level for a user (0 = fine, 1 = warning, 2 = croins locked, 3 = account locked).
CREATE OR REPLACE FUNCTION public.loan_lock_level(_user uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT lock_level FROM public.loan_penalties WHERE user_id = _user), 0)
$$;
