CREATE TYPE public.coupon_type AS ENUM ('percent', 'fixed');

CREATE TABLE public.coupons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL,
  type        public.coupon_type NOT NULL,
  value       numeric(10,2) NOT NULL CHECK (value > 0),
  expires_at  timestamptz,
  max_uses    integer,
  used_count  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupons_code_unique UNIQUE (code)
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_id  uuid REFERENCES public.coupons(id),
  ADD COLUMN IF NOT EXISTS desconto   numeric(10,2) NOT NULL DEFAULT 0;

-- RLS: apenas service_role acessa diretamente
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons_service_role" ON public.coupons
  FOR ALL TO service_role USING (true);
