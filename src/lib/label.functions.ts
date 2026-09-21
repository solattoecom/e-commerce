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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function gerarEtiquetaCore(
  orderId: string,
  supabaseAdmin: any,
): Promise<{ pdf_url: string; codigo_rastreio: string }> {
  const token = process.env["MELHOR_ENVIO_TOKEN"];
  if (!token) throw new Error("MELHOR_ENVIO_TOKEN não configurado.");

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, status, me_service_id, me_order_id, usuario_id, endereco, order_items(quantidade, preco_unitario, products(nome))")
    .eq("id", orderId)
    .single();

  if (!order) throw new Error("Pedido não encontrado.");
  if (!["pago", "separando"].includes(order.status)) throw new Error("Pedido precisa estar pago ou separando.");
  if (!order.me_service_id) throw new Error("Pedido sem serviço Melhor Envio.");
  if (order.me_order_id) throw new Error("Etiqueta já gerada.");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("nome, email, cpf")
    .eq("id", order.usuario_id)
    .single();

  if (!profile?.cpf) throw new Error("CPF do destinatário não cadastrado.");

  const endereco = order.endereco as {
    rua: string; numero: string; complemento?: string;
    bairro: string; cidade: string; estado: string; cep: string;
  };

  const itens = order.order_items as { quantidade: number; preco_unitario: number; products: { nome: string } | null }[];
  const totalItens = itens.reduce((s, i) => s + i.quantidade, 0);
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

  // 1. Adicionar ao carrinho
  const cartRes = await fetch(`${ME_BASE}/cart`, {
    method: "POST",
    headers: meHeaders,
    body: JSON.stringify({
      service: order.me_service_id,
      from: ME_FROM,
      to: {
        name: profile.nome || "Cliente",
        phone: "00000000000",
        email: profile.email ?? "",
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
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!cartRes.ok) throw new Error(`ME Carrinho: ${await cartRes.text()}`);
  const { id: meId } = (await cartRes.json()) as { id: string };

  // 2. Checkout
  const checkoutRes = await fetch(`${ME_BASE}/shipment/checkout`, {
    method: "POST", headers: meHeaders,
    body: JSON.stringify({ orders: [meId] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!checkoutRes.ok) throw new Error(`ME Checkout: ${await checkoutRes.text()}`);

  // 3. Gerar etiqueta
  const generateRes = await fetch(`${ME_BASE}/shipment/generate`, {
    method: "POST", headers: meHeaders,
    body: JSON.stringify({ orders: [meId] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!generateRes.ok) throw new Error(`ME Gerar etiqueta: ${await generateRes.text()}`);
  const generateData = (await generateRes.json()) as Record<string, { tracking: string }>;
  const trackingCode = generateData[meId]?.tracking ?? "";

  // 4. URL do PDF
  const printRes = await fetch(`${ME_BASE}/shipment/print`, {
    method: "POST",
    headers: meHeaders,
    body: JSON.stringify({ orders: [meId] }),
    signal: AbortSignal.timeout(15000),
  });
  const printContentType = printRes.headers.get("content-type") ?? "";
  if (!printRes.ok || printContentType.includes("text/html")) {
    throw new Error(`ME Impressão: resposta inválida (${printRes.status})`);
  }
  const printText = await printRes.text();
  let pdfUrl: string;
  try {
    const parsed = JSON.parse(printText) as { url?: string } | string;
    pdfUrl = typeof parsed === "string" ? parsed : (parsed.url ?? "");
  } catch {
    pdfUrl = printText.trim().replace(/^"|"$/g, "");
  }
  if (!pdfUrl.startsWith("https://")) throw new Error("ME Impressão: URL do PDF inválida.");

  // 5. Salvar no banco
  await supabaseAdmin
    .from("orders")
    .update({
      me_order_id: meId,
      codigo_rastreio: trackingCode || null,
      label_pdf_url: pdfUrl,
      status: "enviado",
    })
    .eq("id", orderId);

  return { pdf_url: pdfUrl, codigo_rastreio: trackingCode, me_order_id: meId };
}

export const getMelhorEnvioSaldo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ saldo: number }> => {
    const token = process.env["MELHOR_ENVIO_TOKEN"];
    if (!token) throw new Error("MELHOR_ENVIO_TOKEN não configurado.");
    const res = await fetch(`${ME_BASE}/balance`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "solatto/1.0 (solattoecom@gmail.com)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`ME Saldo: ${res.status}`);
    const data = (await res.json()) as { balance: string | number };
    return { saldo: Number(data.balance) };
  });

type GenerateLabelInput = { order_id: string };
type GenerateLabelResult = { pdf_url: string; codigo_rastreio: string; me_order_id: string };

export const generateLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GenerateLabelInput) => input)
  .handler(async ({ data }): Promise<GenerateLabelResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");
    return gerarEtiquetaCore(data.order_id, supabaseAdmin);
  });

type ReprintLabelInput = { order_id: string };
type ReprintLabelResult = { pdf_url: string };

export const reprintLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReprintLabelInput) => input)
  .handler(async ({ data }): Promise<ReprintLabelResult> => {
    const token = process.env["MELHOR_ENVIO_TOKEN"];
    if (!token) throw new Error("MELHOR_ENVIO_TOKEN não configurado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("me_order_id")
      .eq("id", data.order_id)
      .single();
    if (!order?.me_order_id) throw new Error("Etiqueta não gerada para este pedido.");

    const meHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "solatto/1.0 (solattoecom@gmail.com)",
    };

    const printRes = await fetch(`${ME_BASE}/shipment/print`, {
      method: "POST",
      headers: meHeaders,
      body: JSON.stringify({ orders: [order.me_order_id] }),
      signal: AbortSignal.timeout(15000),
    });
    const contentType = printRes.headers.get("content-type") ?? "";
    if (!printRes.ok || contentType.includes("text/html")) {
      throw new Error(`ME Impressão: resposta inválida (${printRes.status})`);
    }
    const printText = await printRes.text();
    let pdfUrl: string;
    try {
      const parsed = JSON.parse(printText) as { url?: string } | string;
      pdfUrl = typeof parsed === "string" ? parsed : (parsed.url ?? "");
    } catch {
      pdfUrl = printText.trim().replace(/^"|"$/g, "");
    }
    if (!pdfUrl.startsWith("https://")) throw new Error("ME Impressão: URL do PDF inválida.");

    await supabaseAdmin.from("orders").update({ label_pdf_url: pdfUrl }).eq("id", data.order_id);
    return { pdf_url: pdfUrl };
  });

type GetEtiquetaUrlInput = { order_id: string; index: number };
type GetEtiquetaUrlResult = { url: string; ext: string };

export const getEtiquetaUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GetEtiquetaUrlInput) => input)
  .handler(async ({ data, context }): Promise<GetEtiquetaUrlResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");

    const { count: adminCount } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (!adminCount) throw new Error("Acesso não autorizado.");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("etiqueta_path")
      .eq("id", data.order_id)
      .single();

    if (!order?.etiqueta_path) throw new Error("Etiqueta não encontrada para este pedido.");

    // etiqueta_path pode ser JSON array (múltiplas etiquetas) ou string simples (legado)
    let path: string;
    try {
      const parsed = JSON.parse(order.etiqueta_path) as string[];
      path = parsed[data.index] ?? parsed[0] ?? "";
    } catch {
      path = order.etiqueta_path;
    }
    if (!path) throw new Error("Etiqueta não encontrada para este pedido.");

    const { data: signedData, error } = await supabaseAdmin.storage
      .from("etiquetas")
      .createSignedUrl(path, 120);

    if (error || !signedData?.signedUrl) throw new Error("Não foi possível gerar o link de download.");

    const ext = path.split(".").pop() ?? "pdf";
    return { url: signedData.signedUrl, ext };
  });
