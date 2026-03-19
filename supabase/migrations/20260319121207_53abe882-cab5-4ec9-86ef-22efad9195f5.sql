
CREATE TABLE public.croin_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price numeric NOT NULL DEFAULT 1.00,
  changed_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.croin_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read price history"
  ON public.croin_price_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert initial price point
INSERT INTO public.croin_price_history (price, changed_by)
VALUES (1.00, '00000000-0000-0000-0000-000000000000');

-- Enable realtime for live chart updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.croin_price_history;
