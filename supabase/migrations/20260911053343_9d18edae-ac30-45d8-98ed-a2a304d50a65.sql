-- Financial helpers: server-side only
REVOKE ALL ON FUNCTION public.loan_lock_level(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loan_register_miss(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loan_sweep(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purchase_croin_code(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purchase_loginname(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_share_price(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_loginname_to_user(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.simulate_croin_price() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trade_share(uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transfer_croins(uuid, uuid, bigint, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.loan_lock_level(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.loan_register_miss(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.loan_sweep(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_croin_code(uuid, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_loginname(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_share_price(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_loginname_to_user(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.simulate_croin_price() TO service_role;
GRANT EXECUTE ON FUNCTION public.trade_share(uuid, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_croins(uuid, uuid, bigint, text, text) TO service_role;

-- School helpers: used by access rules for signed-in users, so only remove guest access
REVOKE ALL ON FUNCTION public.get_school_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_school_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_in_class(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_owner_email() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_principal_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_teacher_of_class(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_school_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_school_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_in_class(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_owner_email() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_principal_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid, uuid) TO authenticated, service_role;