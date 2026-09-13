import { createServerFn } from "@tanstack/react-start";

export type DiscountResult = {
  coupon_id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  discount_amount: number;
};

export const validateCoupon = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; subtotal: number }) => input)
  .handler(async ({ data }): Promise<DiscountResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: coupon, error } = await supabaseAdmin
      .from("coupons")
      .select("id, code, type, value, expires_at, max_uses, used_count, active")
      .ilike("code", data.code.trim())
      .single();

    if (error || !coupon) throw new Error("Cupom inválido.");
    if (!coupon.active) throw new Error("Cupom inativo.");
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) throw new Error("Cupom expirado.");
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) throw new Error("Cupom esgotado.");

    const subtotal = Math.max(0, data.subtotal);
    const discount_amount =
      coupon.type === "percent"
        ? subtotal * (coupon.value / 100)
        : Math.min(coupon.value, subtotal);

    return {
      coupon_id: coupon.id,
      code: coupon.code,
      type: coupon.type as "percent" | "fixed",
      value: coupon.value,
      discount_amount: Math.round(discount_amount * 100) / 100,
    };
  });

export const incrementCouponUsage = createServerFn({ method: "POST" })
  .inputValidator((input: { coupon_id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: coupon, error: fetchError } = await supabaseAdmin
      .from("coupons")
      .select("used_count")
      .eq("id", data.coupon_id)
      .single();

    if (fetchError || !coupon) throw new Error("Cupom não encontrado.");

    const { error: updateError } = await supabaseAdmin
      .from("coupons")
      .update({ used_count: coupon.used_count + 1 })
      .eq("id", data.coupon_id);

    if (updateError) throw new Error(updateError.message);
  });
