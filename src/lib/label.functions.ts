import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const ME_BASE = "https://melhorenvio.com.br/api/v2/me";

const ME_FROM = {
  name: "SOLATTO COMERCIO DE CALCADOS ROUPAS E ACESSORIOS LTDA",
  phone: "16999136670",
  email: "solattoecom@gmail.com",
  company_document: "51987195000146",
  address: "R ROMUALDO MAGALHAES PIRRO",
  number: "1050",
  district: "Jd do Eden",
  city: "Franca",
  country_id: "BR",
  postal_code: "14402130",
};

type GenerateLabelInput = { order_id: string };

type GenerateLabelResult = { pdf_url: string; codigo_rastreio: string };

export const generateLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GenerateLabelInput) => input)
  .handler(async ({ data, context: _ctx }): Promise<GenerateLabelResult> => {
    const token = process.env["MELHOR_ENVIO_TOKEN"];
    if (!token) throw new Error("MELHOR_ENVIO_TOKEN não configurado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    // Busca pedido com itens
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, me_service_id, me_order_id, usuario_id, endereco, order_items(quantidade, preco_unitario, products(nome))")
      .eq("id", data.order_id)
      .single();

    if (!order) throw new Error("Pedido não encontrado.");
    if (!["pago", "separando"].includes(order.status)) {
      throw new Error("O pedido precisa estar com status 'pago' ou 'separando'.");
    }
    if (!order.me_service_id) {
      throw new Error("Este pedido não possui serviço Melhor Envio associado.");
    }
    if (order.me_order_id) {
      throw new Error("Etiqueta já gerada para este pedido.");
    }

    // Busca perfil do cliente
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nome, sobrenome, email, cpf")
      .eq("id", order.usuario_id)
      .single();

    if (!profile?.cpf) {
      throw new Error("CPF do destinatário não cadastrado. O cliente precisa informar o CPF no perfil antes de gerar a etiqueta.");
    }

    const endereco = order.endereco as {
      rua: string;
      numero: string;
      complemento?: string;
      bairro: string;
      cidade: string;
      estado: string;
      cep: string;
    };

    const itens = order.order_items as { quantidade: number; preco_unitario: number; products: { nome: string } | null }[];
    const totalItens = itens.reduce((soma, i) => soma + i.quantidade, 0);
    const pesoKg = Math.max(0.1, totalItens * 0.9);
    const products = itens.map((i) => ({
      name: i.products?.nome ?? "Calçado",
      quantity: i.quantidade,
      unitary_value: Number(i.preco_unitario),
    }));
    const insuranceValue = Math.max(1, itens.reduce((s, i) => s + Number(i.preco_unitario) * i.quantidade, 0));

    const meHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "solatto/1.0 (solattoecom@gmail.com)",
    };

    // Passo 1: adicionar ao carrinho
    const cartBody = {
      service: order.me_service_id,
      from: ME_FROM,
      to: {
        name: `${profile?.nome ?? ""} ${profile?.sobrenome ?? ""}`.trim() || "Cliente",
        phone: "00000000000",
        email: profile?.email ?? "",
        document: profile.cpf,
        address: endereco.rua,
        number: endereco.numero,
        complement: endereco.complemento ?? "",
        district: endereco.bairro,
        city: endereco.cidade,
        state_abbr: endereco.estado,
        country_id: "BR",
        postal_code: endereco.cep.replace(/\D/g, ""),
      },
      products,
      volumes: [{ height: 15, width: 22, length: 35, weight: pesoKg }],
      options: { insurance_value: insuranceValue, receipt: false, own_hand: false },
    };

    const cartRes = await fetch(`${ME_BASE}/cart`, {
      method: "POST",
      headers: meHeaders,
      body: JSON.stringify(cartBody),
      signal: AbortSignal.timeout(15000),
    });
    if (!cartRes.ok) {
      const txt = await cartRes.text();
      throw new Error(`ME Carrinho: ${txt}`);
    }
    const cartData = (await cartRes.json()) as { id: string };
    const meId = cartData.id;

    // Passo 2: checkout do carrinho
    const checkoutRes = await fetch(`${ME_BASE}/shipment/checkout`, {
      method: "POST",
      headers: meHeaders,
      body: JSON.stringify({ orders: [meId] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!checkoutRes.ok) {
      const txt = await checkoutRes.text();
      throw new Error(`ME Checkout: ${txt}`);
    }

    // Passo 3: gerar etiqueta
    const generateRes = await fetch(`${ME_BASE}/shipment/generate`, {
      method: "POST",
      headers: meHeaders,
      body: JSON.stringify({ orders: [meId] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!generateRes.ok) {
      const txt = await generateRes.text();
      throw new Error(`ME Gerar etiqueta: ${txt}`);
    }
    const generateData = (await generateRes.json()) as Record<string, { tracking: string }>;
    const trackingCode = generateData[meId]?.tracking ?? "";

    // Passo 4: obter URL do PDF
    const printRes = await fetch(`${ME_BASE}/shipment/print?orders[]=${meId}`, {
      headers: { ...meHeaders, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!printRes.ok) {
      const txt = await printRes.text();
      throw new Error(`ME Impressão: ${txt}`);
    }
    const printText = await printRes.text();
    let pdfUrl: string;
    try {
      const parsed = JSON.parse(printText) as { url?: string } | string;
      pdfUrl = typeof parsed === "string" ? parsed : (parsed.url ?? printText.trim());
    } catch {
      pdfUrl = printText.trim().replace(/^"|"$/g, "");
    }

    // Atualizar pedido: me_order_id, codigo_rastreio, status = "enviado"
    await supabaseAdmin
      .from("orders")
      .update({
        me_order_id: meId,
        codigo_rastreio: trackingCode || null,
        status: "enviado",
      })
      .eq("id", data.order_id);

    return { pdf_url: pdfUrl, codigo_rastreio: trackingCode };
  });
