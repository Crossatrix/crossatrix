CREATE TABLE public.account_lockdowns (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  locked boolean NOT NULL DEFAULT false,
  passcode_hash text,
  locked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_lockdowns TO authenticated;
GRANT ALL ON public.account_lockdowns TO service_role;

ALTER TABLE public.account_lockdowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lockdown status"
  ON public.account_lockdowns
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_account_lockdowns_updated_at
  BEFORE UPDATE ON public.account_lockdowns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();