
REVOKE EXECUTE ON FUNCTION public.take_loan(uuid, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pay_loan(uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.loan_sweep(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.loan_register_miss(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.loan_lock_level(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_loan(uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pay_loan(uuid, uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.loan_sweep(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.loan_register_miss(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.loan_lock_level(uuid) TO service_role;
