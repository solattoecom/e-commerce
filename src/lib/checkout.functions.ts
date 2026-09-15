import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const ABACATEPAY_PIX_URL = "https://api.abacatepay.com/v2/transparents/create";
const ABACATEPAY_PRODUCTS_URL = "https://api.abacatepay.com/v2/products/create";
const ABACATEPAY_CHECKOUT_URL = "https://api.abacatepay.com/v2/checkouts/create";

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
  checkout_url?: string;
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
        const { data: variacao, error: variacaoError } = await supabaseAdmin
          .from("product_variants")
          .select("estoque")
          .eq("id", item.variacao_id)
          .single();
        if (!variacao || variacao.estoque < item.quantidade) {
          throw new Error(`Estoque insuficiente para o produto "${item.nome}". (estoque=${variacao?.estoque ?? "null"} qtd=${item.quantidade})`);
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

    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    if (data.payment_method === "pix") {
      const pixBody = {
        method: "PIX",
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

      const pixRes = await fetch(ABACATEPAY_PIX_URL, { method: "POST", headers, body: JSON.stringify(pixBody) });
      if (!pixRes.ok) {
        const err = await pixRes.text();
        await supabaseAdmin.from("orders").delete().eq("id", order.id);
        throw new Error(`AbacatePay: ${err}`);
      }

      const pixData = await pixRes.json() as { data: { id: string; status: string; brCode?: string; brCodeBase64?: string; expiresAt?: string } };
      await supabaseAdmin.from("orders").update({ payment_id: pixData.data.id }).eq("id", order.id);

      return {
        order_id: order.id,
        payment_method: "pix",
        pix_qr: pixData.data.brCode,
        pix_qr_code: pixData.data.brCodeBase64,
        pix_expiration: pixData.data.expiresAt,
        status: pixData.data.status,
      };
    }

    // Cartão: cria produto temporário no AbacatePay e depois o checkout
    const prodRes = await fetch(ABACATEPAY_PRODUCTS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        externalId: order.id,
        name: `Pedido ${order.id.slice(0, 8).toUpperCase()}`,
        price: Math.round(data.total * 100),
        currency: "BRL",
      }),
    });
    if (!prodRes.ok) {
      const err = await prodRes.text();
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(`AbacatePay produto: ${err}`);
    }
    const prodData = await prodRes.json() as { data: { id: string } };

    const checkoutRes = await fetch(ABACATEPAY_CHECKOUT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        items: [{ id: prodData.data.id, quantity: 1 }],
        methods: ["CARD"],
        externalId: order.id,
        completionUrl: "https://www.solatto.com.br/pedidos",
        metadata: { order_id: order.id },
      }),
    });
    if (!checkoutRes.ok) {
      const err = await checkoutRes.text();
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(`AbacatePay checkout: ${err}`);
    }
    const checkoutData = await checkoutRes.json() as { data: { id: string; url: string; status: string } };
    await supabaseAdmin.from("orders").update({ payment_id: checkoutData.data.id }).eq("id", order.id);

    return {
      order_id: order.id,
      payment_method: "cartao",
      checkout_url: checkoutData.data.url,
      status: checkoutData.data.status,
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

    // Se ainda pendente, consulta AbacatePay diretamente
    if (order.status === "pendente" && order.payment_id) {
      const apiKey = process.env["ABACATEPAY_API_KEY"];
      if (apiKey) {
        try {
          const res = await fetch(`https://api.abacatepay.com/v2/transparents/check?id=${order.payment_id}`, {
            headers: { "Authorization": `Bearer ${apiKey}` },
          });
          const text = await res.text();
          if (res.ok) {
            const json = JSON.parse(text) as { data?: { status?: string } };
            const abacateStatus = json.data?.status?.toUpperCase();
            if (abacateStatus === "PAID" || abacateStatus === "COMPLETED" || abacateStatus === "APPROVED") {
              await supabaseAdmin.from("orders").update({ status: "pago" }).eq("id", order.id);

              const { data: items } = await supabaseAdmin
                .from("order_items")
                .select("variacao_id, quantidade")
                .eq("pedido_id", order.id);
              for (const item of items ?? []) {
                if (!item.variacao_id) continue;
                await supabaseAdmin.rpc("decrement_stock", {
                  p_variacao_id: item.variacao_id,
                  p_quantidade: item.quantidade,
                });
              }

              return { status: "pago", payment_id: order.payment_id };
            }
          }
        } catch (e) {
          console.error("[getOrderStatus] erro ao consultar AbacatePay:", e);
        }
      }
    }

    return { status: order.status, payment_id: order.payment_id };
  });

export const retryPixPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order_id: string }) => input)
  .handler(async ({ data, context }): Promise<{ pix_qr: string; pix_qr_code: string; pix_expiration: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");
    const apiKey = process.env["ABACATEPAY_API_KEY"];
    if (!apiKey) throw new Error("ABACATEPAY_API_KEY não configurada.");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, total, status")
      .eq("id", data.order_id)
      .eq("usuario_id", context.userId)
      .single();

    if (!order) throw new Error("Pedido não encontrado.");
    if (order.status !== "pendente") throw new Error("Este pedido não está mais pendente.");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nome, sobrenome, email")
      .eq("id", context.userId)
      .single();

    const pixRes = await fetch(ABACATEPAY_PIX_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "PIX",
        data: {
          amount: Math.round(order.total * 100),
          description: `Pedido ${order.id.slice(0, 8).toUpperCase()}`,
          expiresIn: 3600,
          externalId: order.id,
          customer: {
            name: `${profile?.nome ?? ""} ${profile?.sobrenome ?? ""}`.trim(),
            email: profile?.email ?? "",
            cellphone: "00000000000",
            taxId: "",
          },
        },
      }),
    });

    if (!pixRes.ok) {
      const err = await pixRes.text();
      throw new Error(`AbacatePay: ${err}`);
    }

    const pixData = await pixRes.json() as { data: { id: string; brCode: string; brCodeBase64: string; expiresAt: string } };
    await supabaseAdmin.from("orders").update({ payment_id: pixData.data.id }).eq("id", order.id);

    return {
      pix_qr: pixData.data.brCode,
      pix_qr_code: pixData.data.brCodeBase64,
      pix_expiration: pixData.data.expiresAt,
    };
  });
