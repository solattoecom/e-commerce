CREATE OR REPLACE FUNCTION public.increment_coupon_used_count(p_coupon_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.coupons
  SET used_count = used_count + 1
  WHERE id = p_coupon_id
    AND used_count < COALESCE(max_uses, 2147483647)
    AND (expires_at IS NULL OR expires_at > now())
    AND active = true;
$$;
