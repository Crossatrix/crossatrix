CREATE TABLE public.status_light (
  id integer PRIMARY KEY DEFAULT 1,
  color text NOT NULL DEFAULT '#22c55e',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT status_light_singleton CHECK (id = 1)
);

GRANT SELECT ON public.status_light TO anon, authenticated;
GRANT ALL ON public.status_light TO service_role;

ALTER TABLE public.status_light ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read status light"
  ON public.status_light FOR SELECT
  USING (true);

CREATE POLICY "Admins can update status light"
  ON public.status_light FOR UPDATE
  TO authenticated
  USING (public.is_owner_email())
  WITH CHECK (public.is_owner_email());

CREATE POLICY "Admins can insert status light"
  ON public.status_light FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner_email());

INSERT INTO public.status_light (id, color, items)
VALUES (1, '#22c55e', '[{"name":"Croins","state":"up","note":""},{"name":"Shares","state":"up","note":""},{"name":"News","state":"up","note":""},{"name":"Login","state":"up","note":""}]'::jsonb);