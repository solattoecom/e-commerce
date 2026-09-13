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

    type CouponRow = {
      id: string; code: string; type: string; value: number;
      expires_at: string | null; max_uses: number | null; used_count: number; active: boolean;
    };
    const { data: coupon, error } = await (supabaseAdmin as any)
      .from("coupons")
      .select("id, code, type, value, expires_at, max_uses, used_count, active")
      .ilike("code", data.code.trim())
      .single() as { data: CouponRow | null; error: unknown };

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
