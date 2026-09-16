export type ShippingOption = {
  id: string;
  nome: string;
  prazo: string;
  valor: number;
};

export type ShippingQuote = {
  cep: string;
  cidade: string;
  uf: string;
  bairro: string;
  logradouro: string;
  opcoes: ShippingOption[];
};

const regiao: Record<string, "SE" | "S" | "CO" | "NE" | "N"> = {
  SP: "SE", RJ: "SE", MG: "SE", ES: "SE",
  PR: "S", SC: "S", RS: "S",
  DF: "CO", GO: "CO", MT: "CO", MS: "CO",
  BA: "NE", SE: "NE", AL: "NE", PE: "NE", PB: "NE", RN: "NE", CE: "NE", PI: "NE", MA: "NE",
  AM: "N", PA: "N", AC: "N", RO: "N", RR: "N", AP: "N", TO: "N",
};

const tabela: Record<string, { base: number; prazo: number }> = {
  SE: { base: 19.9, prazo: 3 },
  S: { base: 24.9, prazo: 4 },
  CO: { base: 29.9, prazo: 6 },
  NE: { base: 34.9, prazo: 8 },
  N: { base: 39.9, prazo: 10 },
};

export async function quoteShipping(input: { cep: string; itens: number; subtotal: number }): Promise<ShippingQuote> {
  const cep = String(input.cep ?? "").replace(/\D/g, "");
  if (cep.length !== 8) throw new Error("CEP inválido. Digite os 8 números.");

  const itens = Math.max(1, Number(input.itens) || 1);
  const subtotal = Math.max(0, Number(input.subtotal) || 0);

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!response.ok) throw new Error("Não foi possível consultar o CEP agora.");
  const endereco = (await response.json()) as {
    erro?: boolean | string;
    localidade?: string;
    uf?: string;
    bairro?: string;
    logradouro?: string;
  };
  if (endereco.erro || !endereco.uf) throw new Error("CEP não encontrado.");

  const uf = endereco.uf;
  const faixa = tabela[regiao[uf] ?? "SE"]!;
  const extra = (itens - 1) * 6.5;
  const gratis = subtotal >= 399.9;

  const economico = Number((gratis ? 0 : faixa.base + extra).toFixed(2));
  const expresso = Number((faixa.base * 1.85 + extra).toFixed(2));

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
        valor: economico,
      },
      {
        id: "expresso",
        nome: "Entrega expressa",
        prazo: `${Math.max(1, faixa.prazo - 2)} a ${faixa.prazo} dias úteis`,
        valor: expresso,
      },
    ],
  };
}
