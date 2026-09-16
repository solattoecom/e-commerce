import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";
import { quoteShipping } from "@/lib/shipping.functions";
import { isValidCpf, assertInputLimits } from "@/lib/validate";

const ABACATEPAY_PIX_URL = "https://api.abacatepay.com/v2/transparents/create";
const ABACATEPAY_PRODUCTS_URL = "https://api.abacatepay.com/v2/products/create";
const ABACATEPAY_CHECKOUT_URL = "https://api.abacatepay.com/v2/checkouts/create";
const ASAAS_API_URL = "https://api.asaas.com/v3";

type OrderItem = {
  produto_id: string;
  variacao_id: string | null;
  nome: string;
  quantidade: number;
};

type CreateOrderInput = {
  address_id: string;
  shipping_option_id: string;
  shipping_nome: string;
  payment_method: "pix" | "cartao" | "boleto";
  telefone: string;
  items: OrderItem[];
  card_number?: string;
  card_holder?: string;
  card_expiry?: string;
  card_cvv?: string;
  card_cpf?: string;
  card_telefone?: string;
  card_parcelas?: number;
  boleto_cpf?: string;
  coupon_id?: string | null;
};

export type CreateOrderResult = {
  order_id: string;
  payment_method: "pix" | "cartao" | "boleto";
  pix_qr?: string | undefined;
  pix_qr_code?: string | undefined;
  pix_expiration?: string | undefined;
  checkout_url?: string | undefined;
  boleto_url?: string | undefined;
  status: string;
};

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateOrderInput) => input)
  .handler(async ({ data, context }): Promise<CreateOrderResult> => {
    // Validação de tamanho dos inputs
    assertInputLimits(data as unknown as Record<string, unknown>, {
      telefone: 20, card_holder: 100, card_number: 19,
      card_expiry: 7, card_cvv: 4, card_cpf: 14,
      card_telefone: 20, boleto_cpf: 14, shipping_nome: 100,
    });

    // Validação de CPF
    if (data.payment_method === "cartao" && data.card_cpf) {
      if (!isValidCpf(data.card_cpf)) throw new Error("CPF do cartão inválido.");
    }
    if (data.payment_method === "boleto" && data.boleto_cpf) {
      if (!isValidCpf(data.boleto_cpf)) throw new Error("CPF do boleto inválido.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");
    const apiKey = process.env["ABACATEPAY_API_KEY"];
    if (!apiKey) throw new Error("ABACATEPAY_API_KEY não configurada.");

    // Busca tipo de cliente do usuário
    const { data: clientTypeRow } = await supabaseAdmin
      .from("user_client_types")
      .select("tipo")
      .eq("user_id", context.userId)
      .single();
    const clientType = clientTypeRow?.tipo ?? "varejo";

    // Busca preços server-side para cada produto
    const produtoIds = data.items.map((i) => i.produto_id);
    const { data: prices } = await supabaseAdmin
      .from("product_prices")
      .select("produto_id, preco")
      .in("produto_id", produtoIds)
      .eq("tipo", clientType);

    const priceMap = new Map((prices ?? []).map((p) => [p.produto_id, p.preco]));

    // Valida quantidade máxima por item
    for (const item of data.items) {
      if (item.quantidade < 1 || item.quantidade > 20) throw new Error(`Quantidade inválida para "${item.nome}".`);
      if (!priceMap.has(item.produto_id)) throw new Error(`Preço não encontrado para "${item.nome}".`);
    }

    // Limite de pedidos pendentes por usuário (anti-bot)
    const { count: pendingCount } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", context.userId)
      .eq("status", "pendente");
    if ((pendingCount ?? 0) >= 5) throw new Error("Você já tem muitos pedidos pendentes. Conclua ou cancele antes de criar um novo.");

    const itemsComPreco = data.items.map((item) => ({
      ...item,
      preco_unitario: priceMap.get(item.produto_id)!,
    }));

    const subtotal = Math.round(itemsComPreco.reduce((acc, i) => acc + i.preco_unitario * i.quantidade, 0) * 100) / 100;

    // Valida e calcula desconto do cupom server-side
    let desconto = 0;
    if (data.coupon_id) {
      const { data: coupon } = await supabaseAdmin
        .from("coupons")
        .select("type, value, expires_at, max_uses, used_count, active")
        .eq("id", data.coupon_id)
        .single();
      if (coupon && coupon.active &&
        !(coupon.expires_at && new Date(coupon.expires_at) < new Date()) &&
        !(coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)) {
        desconto = coupon.type === "percent"
          ? Math.round(subtotal * (coupon.value / 100) * 100) / 100
          : Math.min(coupon.value, subtotal);
      }
    }

    // Calcula frete server-side
    const { data: address } = await supabaseAdmin
      .from("addresses")
      .select("*")
      .eq("id", data.address_id)
      .eq("user_id", context.userId)
      .single();
    if (!address) throw new Error("Endereço não encontrado.");

    const shippingQuote = await quoteShipping({ data: { cep: address.cep, itens: data.items.length, subtotal, clientTipo: clientType as "varejo" | "atacado" | "dropshipping" } });
    const shippingOption = shippingQuote.opcoes.find((o) => o.id === data.shipping_option_id);
    if (!shippingOption) throw new Error("Opção de frete inválida.");
    const shippingValor = shippingOption.valor;

    const total = Math.round((subtotal - desconto + shippingValor) * 100) / 100;

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
        subtotal,
        frete: shippingValor,
        total,
        endereco: address,
        payment_method: data.payment_method,
        address_id: data.address_id,
        coupon_id: data.coupon_id ?? null,
        desconto,
      })
      .select("id")
      .single();
    if (orderError || !order) throw new Error("Erro ao criar pedido.");

    await supabaseAdmin.from("order_items").insert(
      itemsComPreco.map((item) => ({
        pedido_id: order.id,
        produto_id: item.produto_id,
        variacao_id: item.variacao_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        subtotal: item.preco_unitario * item.quantidade,
      }))
    );

    // Reserva estoque atomicamente — falha se insuficiente
    for (const item of itemsComPreco) {
      if (!item.variacao_id) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: stockErr } = await (supabaseAdmin.rpc as any)("reserve_stock", {
        p_variacao_id: item.variacao_id,
        p_quantidade: item.quantidade,
      });
      if (stockErr) {
        await supabaseAdmin.from("orders").delete().eq("id", order.id);
        throw new Error(`Estoque insuficiente para "${item.nome}".`);
      }
    }

    // Restaura estoque e deleta pedido se pagamento falhar
    async function cancelarPedido() {
      for (const item of itemsComPreco) {
        if (!item.variacao_id) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin.rpc as any)("restore_stock", {
          p_variacao_id: item.variacao_id,
          p_quantidade: item.quantidade,
        });
      }
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
    }

    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    if (data.payment_method === "pix") {
      const pixBody = {
        method: "PIX",
        data: {
          amount: Math.round(total * 100),
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
        await cancelarPedido();
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

    // Boleto: Asaas
    if (data.payment_method === "boleto") {
      const asaasKey = process.env["ASAAS_API_KEY"];
      if (!asaasKey) {
        await cancelarPedido();
        throw new Error("ASAAS_API_KEY não configurada.");
      }

      const asaasHeaders = { "access_token": asaasKey, "Content-Type": "application/json" };

      const custRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: "POST",
        headers: asaasHeaders,
        body: JSON.stringify({
          name: `${profile.nome} ${profile.sobrenome}`.trim(),
          cpfCnpj: (data.boleto_cpf ?? "").replace(/\D/g, ""),
          email: profile.email,
          externalReference: context.userId,
        }),
      });
      if (!custRes.ok) {
        const err = await custRes.text();
        await cancelarPedido();
        throw new Error(`Erro ao registrar cliente: ${err}`);
      }
      const custData = await custRes.json() as { id: string };

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      const dueDateStr = dueDate.toISOString().split("T")[0];

      const payRes = await fetch(`${ASAAS_API_URL}/payments`, {
        method: "POST",
        headers: asaasHeaders,
        body: JSON.stringify({
          customer: custData.id,
          billingType: "BOLETO",
          value: total,
          dueDate: dueDateStr,
          description: `Pedido ${order.id.slice(0, 8).toUpperCase()}`,
          externalReference: order.id,
        }),
      });

      const payText = await payRes.text();
      if (!payRes.ok) {
        await cancelarPedido();
        let msg = "Erro ao gerar boleto.";
        try {
          const errJson = JSON.parse(payText) as { errors?: { description: string }[] };
          if (errJson.errors?.[0]?.description) msg = errJson.errors[0].description;
        } catch { /* empty */ }
        throw new Error(msg);
      }

      const payData = JSON.parse(payText) as { id: string; bankSlipUrl: string; status: string };
      await supabaseAdmin.from("orders").update({ payment_id: payData.id }).eq("id", order.id);

      return {
        order_id: order.id,
        payment_method: "boleto",
        boleto_url: payData.bankSlipUrl,
        status: "pendente",
      };
    }

    // Cartão: Asaas
    const asaasKey = process.env["ASAAS_API_KEY"];
    if (!asaasKey) {
      await cancelarPedido();
      throw new Error("ASAAS_API_KEY não configurada.");
    }

    const asaasHeaders = { "access_token": asaasKey, "Content-Type": "application/json" };

    const custRes = await fetch(`${ASAAS_API_URL}/customers`, {
      method: "POST",
      headers: asaasHeaders,
      body: JSON.stringify({
        name: `${profile.nome} ${profile.sobrenome}`.trim(),
        cpfCnpj: (data.card_cpf ?? "").replace(/\D/g, ""),
        email: profile.email,
        externalReference: context.userId,
      }),
    });
    if (!custRes.ok) {
      const err = await custRes.text();
      await cancelarPedido();
      throw new Error(`Erro ao registrar cliente: ${err}`);
    }
    const custData = await custRes.json() as { id: string };

    const [expiryMonth, expiryYearRaw = ""] = (data.card_expiry ?? "").split("/");
    const expiryYear = expiryYearRaw.length === 2 ? `20${expiryYearRaw}` : expiryYearRaw;

    const payRes = await fetch(`${ASAAS_API_URL}/payments`, {
      method: "POST",
      headers: asaasHeaders,
      body: JSON.stringify({
        customer: custData.id,
        billingType: "CREDIT_CARD",
        value: total,
        dueDate: new Date().toISOString().split("T")[0],
        description: `Pedido ${order.id.slice(0, 8).toUpperCase()}`,
        externalReference: order.id,
        installmentCount: data.card_parcelas && data.card_parcelas > 1 ? data.card_parcelas : undefined,
        installmentValue: data.card_parcelas && data.card_parcelas > 1 ? (() => {
          const n = data.card_parcelas!;
          if (n <= 10) return Number((total / n).toFixed(2));
          const taxa = 0.0199;
          return Number((total * (taxa * Math.pow(1 + taxa, n)) / (Math.pow(1 + taxa, n) - 1)).toFixed(2));
        })() : undefined,
        creditCard: {
          holderName: data.card_holder,
          number: (data.card_number ?? "").replace(/\s/g, ""),
          expiryMonth,
          expiryYear,
          ccv: data.card_cvv,
        },
        creditCardHolderInfo: {
          name: `${profile.nome} ${profile.sobrenome}`.trim(),
          email: profile.email,
          cpfCnpj: (data.card_cpf ?? "").replace(/\D/g, ""),
          postalCode: (address.cep ?? "").replace(/\D/g, ""),
          addressNumber: String(address.numero ?? ""),
          phone: data.card_telefone || data.telefone || "",
        },
      }),
    });

    const payText = await payRes.text();
    if (!payRes.ok) {
      await cancelarPedido();
      let msg = "Pagamento recusado.";
      try {
        const errJson = JSON.parse(payText) as { errors?: { description: string }[] };
        if (errJson.errors?.[0]?.description) msg = errJson.errors[0].description;
      } catch { /* empty */ }
      throw new Error(msg);
    }

    const payData = JSON.parse(payText) as { id: string; status: string };
    await supabaseAdmin.from("orders").update({ payment_id: payData.id }).eq("id", order.id);

    const confirmed = payData.status === "CONFIRMED" || payData.status === "RECEIVED";
    if (confirmed) {
      await supabaseAdmin.from("orders").update({ status: "pago" }).eq("id", order.id);
    }

    return {
      order_id: order.id,
      payment_method: "cartao",
      status: confirmed ? "pago" : payData.status.toLowerCase(),
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

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("id", data.order_id)
      .eq("usuario_id", context.userId)
      .single();

    if (!order) throw new Error("Pedido não encontrado.");
    if (order.status !== "pendente") throw new Error("Só é possível cancelar pedidos pendentes.");

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelado" })
      .eq("id", data.order_id)
      .eq("status", "pendente");

    if (error) throw new Error("Erro ao cancelar pedido.");
  });
