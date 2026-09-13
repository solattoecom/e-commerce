import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const ABACATEPAY_URL = "https://api.abacatepay.com/v2/transparents/create";

type OrderItem = {
  produto_id: string;
  variacao_id: string | null;
  nome: string;
  quantidade: number;
  preco_unitario: number;
};

type CreateOrderInput = {
  address_id: string;
  shipping_option_id: string;
  shipping_valor: number;
  shipping_nome: string;
  payment_method: "pix" | "cartao";
  telefone: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  card_number?: string;
  card_holder?: string;
  card_expiry?: string;
  card_cvv?: string;
  coupon_id?: string | null;
  desconto?: number;
};

export type CreateOrderResult = {
  order_id: string;
  payment_method: "pix" | "cartao";
  pix_qr?: string;
  pix_qr_code?: string;
  pix_expiration?: string;
  status: string;
};

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateOrderInput) => input)
  .handler(async ({ data, context }): Promise<CreateOrderResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");
    const apiKey = process.env["ABACATEPAY_API_KEY"];
    if (!apiKey) throw new Error("ABACATEPAY_API_KEY não configurada.");

    for (const item of data.items) {
      if (item.variacao_id) {
        const { data: variacao } = await supabaseAdmin
          .from("product_variants")
          .select("estoque")
          .eq("id", item.variacao_id)
          .single();
        if (!variacao || variacao.estoque < item.quantidade) {
          throw new Error(`Estoque insuficiente para o produto "${item.nome}".`);
        }
      }
    }

    const { data: address } = await supabaseAdmin
      .from("addresses")
      .select("*")
      .eq("id", data.address_id)
      .eq("user_id", context.userId)
      .single();
    if (!address) throw new Error("Endereço não encontrado.");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nome, sobrenome, email")
      .eq("id", context.userId)
      .single();
    if (!profile) throw new Error("Perfil não encontrado.");

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        usuario_id: context.userId,
        status: "pendente",
        subtotal: data.subtotal,
        frete: data.shipping_valor,
        total: data.total,
        endereco: address,
        payment_method: data.payment_method,
        address_id: data.address_id,
        coupon_id: data.coupon_id ?? null,
        desconto: data.desconto ?? 0,
      })
      .select("id")
      .single();
    if (orderError || !order) throw new Error("Erro ao criar pedido.");

    await supabaseAdmin.from("order_items").insert(
      data.items.map((item) => ({
        pedido_id: order.id,
        produto_id: item.produto_id,
        variacao_id: item.variacao_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        subtotal: item.preco_unitario * item.quantidade,
      }))
    );

    if (data.coupon_id) {
      await (supabaseAdmin as any).rpc("increment_coupon_used_count", { p_coupon_id: data.coupon_id });
    }

    const abacateBody = {
      method: data.payment_method === "pix" ? "PIX" : "CREDIT_CARD",
      data: {
        amount: Math.round(data.total * 100),
        description: `Pedido ${order.id.slice(0, 8).toUpperCase()}`,
        expiresIn: 3600,
        externalId: order.id,
        customer: {
          name: `${profile.nome} ${profile.sobrenome}`.trim(),
          email: profile.email,
          cellphone: data.telefone || "00000000000",
          taxId: "",
        },
      },
    };

    const abacateRes = await fetch(ABACATEPAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(abacateBody),
    });

    if (!abacateRes.ok) {
      const err = await abacateRes.text();
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(`AbacatePay: ${err}`);
    }

    const abacateData = await abacateRes.json() as {
      data: {
        id: string;
        status: string;
        brCode?: string;
        brCodeBase64?: string;
        expiresAt?: string;
      };
    };

    await supabaseAdmin
      .from("orders")
      .update({ payment_id: abacateData.data.id })
      .eq("id", order.id);

    return {
      order_id: order.id,
      payment_method: data.payment_method,
      pix_qr: abacateData.data.brCode,
      pix_qr_code: abacateData.data.brCodeBase64,
      pix_expiration: abacateData.data.expiresAt,
      status: abacateData.data.status,
    };
  });

export const getOrderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_id")
      .eq("id", data.order_id)
      .eq("usuario_id", context.userId)
      .single();

    if (!order) throw new Error("Pedido não encontrado.");
    return { status: order.status, payment_id: order.payment_id };
  });
