
REVOKE EXECUTE ON FUNCTION public.get_school_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_school_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_principal_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_teacher_of_class(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_in_class(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_owner_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_school_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_school_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_principal_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_in_class(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_email() TO authenticated;
