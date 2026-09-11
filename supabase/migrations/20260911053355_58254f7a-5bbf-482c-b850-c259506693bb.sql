REVOKE ALL ON FUNCTION public.record_share_price() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.share_categories_recompute() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_share_price() TO service_role;
GRANT EXECUTE ON FUNCTION public.share_categories_recompute() TO service_role;