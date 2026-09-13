import { useState } from "react";
import { Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateCoupon, type DiscountResult } from "@/lib/coupon.functions";

type Props = {
  subtotal: number;
  onApply: (discount: DiscountResult | null) => void;
};

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CouponInput({ subtotal, onApply }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<DiscountResult | null>(null);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await validateCoupon({ data: { code: code.trim(), subtotal } });
      setApplied(result);
      onApply(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cupom inválido.");
      setApplied(null);
      onApply(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setCode("");
    setApplied(null);
    setError(null);
    onApply(null);
  };

  if (applied) {
    return (
      <div className="mb-4 rounded-lg border border-border p-3">
        <p className="mb-1 flex items-center gap-2 text-sm font-medium">
          <Tag className="size-4" /> Cupom aplicado
        </p>
        <div className="flex items-center justify-between">
          <div>
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
              {applied.code}
            </span>
            <span className="ml-2 text-sm text-green-700 font-medium">
              -{brl(applied.discount_amount)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Remover cupom"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Tag className="size-4" /> Cupom de desconto
      </p>
      <form onSubmit={handleApply} className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Digite o cupom"
          aria-label="Código do cupom"
          className="h-10 focus-visible:ring-border"
        />
        <Button
          type="submit"
          disabled={loading || !code.trim()}
          className="h-10 cursor-pointer rounded-md bg-foreground px-4 text-background hover:bg-foreground/90"
        >
          {loading ? "..." : "Aplicar"}
        </Button>
      </form>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
