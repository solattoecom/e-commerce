import { useState } from "react";
import { Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { quoteShipping, type ShippingOption, type ShippingQuote } from "@/lib/shipping.functions";

const brl = (value: number) =>
  value === 0 ? "Grátis" : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Props = {
  itens: number;
  subtotal: number;
  onSelect?: (option: ShippingOption | null) => void;
};

export function ShippingCalculator({ itens, subtotal, onSelect }: Props) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await quoteShipping({ cep, itens, subtotal });
      setQuote(result);
      const first = result.opcoes[0] ?? null;
      setSelected(first?.id ?? null);
      onSelect?.(first);
    } catch (err) {
      setQuote(null);
      setSelected(null);
      onSelect?.(null);
      setError(err instanceof Error ? err.message : "Não foi possível calcular o frete.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-border p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Truck className="size-4" /> Calcular frete
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={cep}
          onChange={(event) => setCep(event.target.value.replace(/\D/g, "").slice(0, 8))}
          inputMode="numeric"
          placeholder="Digite seu CEP"
          aria-label="CEP"
          className="h-10"
        />
        <Button
          type="submit"
          disabled={loading || cep.replace(/\D/g, "").length !== 8}
          className="h-10 cursor-pointer rounded-md bg-foreground px-4 text-background hover:bg-foreground/90"
        >
          {loading ? "..." : "Calcular"}
        </Button>
      </form>

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      {quote ? (
        <div className="mt-3 grid gap-2">
          <p className="text-xs text-muted-foreground">
            {[quote.bairro, quote.cidade].filter(Boolean).join(" · ")} {quote.uf} · {quote.cep}
          </p>
          {quote.opcoes.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border p-2 text-sm ${
                selected === option.id ? "border-foreground" : "border-border"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="frete"
                  className="cursor-pointer"
                  checked={selected === option.id}
                  onChange={() => {
                    setSelected(option.id);
                    onSelect?.(option);
                  }}
                />
                <span>
                  <span className="block">{option.nome}</span>
                  <span className="block text-xs text-muted-foreground">{option.prazo}</span>
                </span>
              </span>
              <span className="font-medium">{brl(option.valor)}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
