import { createServerFn } from "@tanstack/react-start";

export type ShippingOption = {
  id: string;
  nome: string;
  prazo: string;
  valor: number;
  me_service_id?: number;
};

export type ShippingQuote = {
  cep: string;
  cidade: string;
  uf: string;
  bairro: string;
  logradouro: string;
  opcoes: ShippingOption[];
};

type QuoteInput = {
  cep: string;
  itens: number;
  subtotal: number;
  clientTipo?: "varejo" | "dropshipping";
};

// ── tabela regional (fallback quando Melhor Envio falha) ─────────────────────

const regiao: Record<string, "SE" | "S" | "CO" | "NE" | "N"> = {
  SP: "SE", RJ: "SE", MG: "SE", ES: "SE",
  PR: "S",  SC: "S",  RS: "S",
  DF: "CO", GO: "CO", MT: "CO", MS: "CO",
  BA: "NE", SE: "NE", AL: "NE", PE: "NE", PB: "NE",
  RN: "NE", CE: "NE", PI: "NE", MA: "NE",
  AM: "N",  PA: "N",  AC: "N",  RO: "N",
  RR: "N",  AP: "N",  TO: "N",
};

const tabela: Record<string, { base: number; prazo: number; extraKg: number }> = {
  SE: { base: 19.9,  prazo: 3,  extraKg: 14 },
  S:  { base: 24.9,  prazo: 4,  extraKg: 17 },
  CO: { base: 29.9,  prazo: 6,  extraKg: 20 },
  NE: { base: 34.9,  prazo: 8,  extraKg: 23 },
  N:  { base: 39.9,  prazo: 10, extraKg: 26 },
};

async function cotarPorTabela(
  cep: string,
  itens: number,
  subtotal: number,
): Promise<ShippingQuote> {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!res.ok) throw new Error("Não foi possível consultar o CEP agora.");
  const endereco = (await res.json()) as {
    erro?: boolean | string;
    localidade?: string;
    uf?: string;
    bairro?: string;
    logradouro?: string;
  };
  if (endereco.erro || !endereco.uf) throw new Error("CEP não encontrado.");

  const uf = endereco.uf;
  const faixa = tabela[regiao[uf] ?? "SE"]!;
  const pesoKg = itens * 0.9;
  const extraKg = Math.max(0, pesoKg - 1);
  const extra = extraKg * faixa.extraKg;
  const gratis = subtotal >= 399.9;

  return {
    cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
    cidade: endereco.localidade ?? "",
    uf,
    bairro: endereco.bairro ?? "",
    logradouro: endereco.logradouro ?? "",
    opcoes: [
      {
        id: "economico",
        nome: gratis ? "Entrega padrão (grátis)" : "Entrega padrão",
        prazo: `${faixa.prazo} a ${faixa.prazo + 3} dias úteis`,
        valor: Number((gratis ? 0 : faixa.base + extra).toFixed(2)),
      },
      {
        id: "expresso",
        nome: "Entrega expressa",
        prazo: `${Math.max(1, faixa.prazo - 2)} a ${faixa.prazo} dias úteis`,
        valor: Number((faixa.base * 1.85 + extra).toFixed(2)),
      },
    ],
  };
}

// ── Melhor Envio ──────────────────────────────────────────────────────────────

type MEServico = {
  id: number;
  name: string;
  price: string | null;
  custom_price: string | null;
  delivery_time: number;
  custom_delivery_range?: { min: number; max: number };
  delivery_range?: { min: number; max: number };
  company: { name: string };
  error: string | null;
};

async function cotarMelhorEnvio(
  cep: string,
  itens: number,
  subtotal: number,
): Promise<ShippingQuote | null> {
  const token = process.env["MELHOR_ENVIO_TOKEN"];
  if (!token) return null;

  const pesoKg = itens * 0.9;

  const body = {
    from: { postal_code: "14402130" },
    to: { postal_code: cep },
    package: { height: 15, width: 22, length: 35, weight: pesoKg },
    options: { receipt: false, own_hand: false },
  };

  let res: Response;
  try {
    res = await fetch("https://melhorenvio.com.br/api/v2/me/shipment/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "solatto/1.0 (solattoecom@gmail.com)",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return null;
  }

  if (!res.ok) {
    console.error("[ME] HTTP error", res.status, await res.text().catch(() => ""));
    return null;
  }

  const servicos = (await res.json()) as MEServico[];
  if (!Array.isArray(servicos)) {
    console.error("[ME] resposta não é array:", JSON.stringify(servicos).slice(0, 300));
    return null;
  }

  const validos = servicos
    .filter((s) => !s.error && s.price !== null)
    .sort((a, b) => Number(a.price) - Number(b.price));

  if (validos.length === 0) {
    console.error("[ME] nenhum serviço válido. erros:", JSON.stringify(servicos.map((s) => ({ id: s.id, error: s.error, price: s.price }))));
    return null;
  }

  // Busca cidade/bairro via ViaCEP para preencher o retorno
  let cidade = "";
  let uf = "";
  let bairro = "";
  let logradouro = "";
  try {
    const vr = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (vr.ok) {
      const ve = (await vr.json()) as {
        localidade?: string; uf?: string; bairro?: string; logradouro?: string;
      };
      cidade = ve.localidade ?? "";
      uf = ve.uf ?? "";
      bairro = ve.bairro ?? "";
      logradouro = ve.logradouro ?? "";
    }
  } catch { /* ignora */ }

  const gratis = subtotal >= 399.9;

  const mapear = (s: MEServico, label: "economico" | "expresso"): ShippingOption => {
    const preco = Number(s.custom_price ?? s.price ?? 0);
    const range = s.custom_delivery_range ?? s.delivery_range;
    const prazo = range
      ? `${range.min} a ${range.max} dias úteis`
      : `${s.delivery_time} dias úteis`;
    const nomeBase = `${s.company.name} — ${s.name}`;
    return {
      id: label,
      nome: label === "economico"
        ? (gratis ? `${nomeBase} (grátis)` : nomeBase)
        : nomeBase,
      prazo,
      valor: label === "economico" && gratis ? 0 : Number(preco.toFixed(2)),
      me_service_id: s.id,
    };
  };

  const pac   = validos.find((s) => s.id === 1);  // PAC
  const sedex = validos.find((s) => s.id === 2);  // SEDEX

  const correiosDisponiveis = pac || sedex;

  let economico: MEServico;
  let expresso: MEServico | undefined;

  if (correiosDisponiveis) {
    economico = pac ?? sedex!;
    expresso  = pac && sedex ? sedex : undefined;
  } else {
    economico = validos[0]!;
    const maisRapido = validos.reduce((melhor, s) => {
      const prazoS = (s.custom_delivery_range ?? s.delivery_range)?.min ?? s.delivery_time;
      const prazoM = (melhor.custom_delivery_range ?? melhor.delivery_range)?.min ?? melhor.delivery_time;
      return prazoS < prazoM ? s : melhor;
    });
    if (maisRapido.id !== economico.id) expresso = maisRapido;
  }

  const opcoes: ShippingOption[] = [mapear(economico, "economico")];
  if (expresso) opcoes.push(mapear(expresso, "expresso"));

  return {
    cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
    cidade,
    uf,
    bairro,
    logradouro,
    opcoes,
  };
}

// ── server function pública ───────────────────────────────────────────────────

export const quoteShipping = createServerFn({ method: "POST" })
  .inputValidator((input: QuoteInput) => input)
  .handler(async ({ data }): Promise<ShippingQuote> => {
    const cep = String(data.cep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) throw new Error("CEP inválido. Digite os 8 números.");

    const itens = Math.max(1, Number(data.itens) || 1);
    const subtotal = Math.max(0, Number(data.subtotal) || 0);
    const clientTipo = data.clientTipo ?? "varejo";

    if (clientTipo === "dropshipping") {
      let cidade = "", uf = "", bairro = "", logradouro = "";
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        if (res.ok) {
          const endereco = await res.json() as { localidade?: string; uf?: string; bairro?: string; logradouro?: string; erro?: boolean };
          if (!endereco.erro) {
            cidade = endereco.localidade ?? "";
            uf = endereco.uf ?? "";
            bairro = endereco.bairro ?? "";
            logradouro = endereco.logradouro ?? "";
          }
        }
      } catch { /* ignora */ }
      return {
        cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
        cidade,
        uf,
        bairro,
        logradouro,
        opcoes: [
          {
            id: "etiqueta_propria",
            nome: "Etiqueta própria — você fornece a etiqueta",
            prazo: "Conforme sua transportadora",
            valor: 0,
          },
        ],
      };
    }

    const resultado = await cotarMelhorEnvio(cep, itens, subtotal);
    if (resultado) return resultado;

    return cotarPorTabela(cep, itens, subtotal);
  });
