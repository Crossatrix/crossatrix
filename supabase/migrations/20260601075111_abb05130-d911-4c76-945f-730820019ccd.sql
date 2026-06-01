-- Track historical share prices for live charts
CREATE TABLE public.share_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id UUID NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_price_history_share ON public.share_price_history(share_id, created_at);

GRANT SELECT ON public.share_price_history TO anon;
GRANT SELECT ON public.share_price_history TO authenticated;
GRANT ALL ON public.share_price_history TO service_role;

ALTER TABLE public.share_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read share price history"
ON public.share_price_history
FOR SELECT
USING (true);

CREATE POLICY "Deny client inserts sph"
ON public.share_price_history FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client updates sph"
ON public.share_price_history FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny client deletes sph"
ON public.share_price_history FOR DELETE TO authenticated USING (false);

-- Record a history point whenever a share is created or its price changes
CREATE OR REPLACE FUNCTION public.record_share_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.price IS DISTINCT FROM OLD.price) THEN
    INSERT INTO public.share_price_history (share_id, price)
    VALUES (NEW.id, NEW.price);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_share_price
AFTER INSERT OR UPDATE OF price ON public.shares
FOR EACH ROW EXECUTE FUNCTION public.record_share_price();

-- Seed an initial point for existing shares
INSERT INTO public.share_price_history (share_id, price)
SELECT id, price FROM public.shares;

-- Enable realtime for live chart updates
ALTER TABLE public.share_price_history REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.share_price_history;