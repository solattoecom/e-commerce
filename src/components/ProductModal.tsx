import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Shield, Truck } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/external";

export type Product = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  categories: { nome: string } | null;
  product_images: { url: string; ordem: number }[];
  product_variants: { id: string; tamanho: string; estoque: number }[];
  product_prices: { preco: number; preco_original: number | null }[];
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ProductModal({
  product,
  onClose,
  onAdd,
  signedIn,
}: {
  product: Product;
  onClose: () => void;
  onAdd?: (produtoId: string, variacaoId: string | null) => void;
  signedIn: boolean;
}) {
  const [foto, setFoto] = useState(0);
  const [tamanho, setTamanho] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [adicionado, setAdicionado] = useState(false);
  const [mediaAval, setMediaAval] = useState(0);
  const [totalAval, setTotalAval] = useState(0);

  const imagens = [...product.product_images].sort((a, b) => a.ordem - b.ordem);
  const variantes = [...product.product_variants].sort((a, b) =>
    a.tamanho.localeCompare(b.tamanho, "pt-BR", { numeric: true }),
  );
  const price = product.product_prices[0];

  useEffect(() => {
    supabase
      .from("product_reviews")
      .select("nota")
      .eq("produto_id", product.id)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const soma = (data as { nota: number }[]).reduce((s, a) => s + a.nota, 0);
        setMediaAval(soma / data.length);
        setTotalAval(data.length);
      });
  }, [product.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const prev = () => setFoto((f) => (f - 1 + imagens.length) % imagens.length);
  const next = () => setFoto((f) => (f + 1) % imagens.length);

  const adicionar = () => {
    if (!signedIn) {
      onClose();
      return;
    }
    if (variantes.length > 0 && !tamanho) {
      setAviso("Escolha a numeração antes de adicionar.");
      return;
    }
    setAviso(null);
    onAdd?.(product.id, tamanho);
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-foreground/50 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[860px] overflow-hidden rounded-2xl bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 cursor-pointer rounded-full p-2 text-foreground transition-colors hover:bg-muted"
        >
          <X className="size-5" />
        </button>

        <div className="grid md:grid-cols-2">
          {/* Imagem */}
          <div className="relative aspect-square bg-muted/20">
            {imagens.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Sem foto</div>
            ) : (
              imagens.map((img, i) => (
                <img
                  key={img.url}
                  src={img.url}
                  alt={`${product.nome} — foto ${i + 1}`}
                  className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
                    i === foto ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))
            )}
            {imagens.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Foto anterior"
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border border-border bg-background/80 p-2 backdrop-blur hover:bg-background"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Próxima foto"
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border border-border bg-background/80 p-2 backdrop-blur hover:bg-background"
                >
                  <ChevronRight className="size-4" />
                </button>
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                  {imagens.map((img, i) => (
                    <button
                      key={`dot-${img.url}`}
                      type="button"
                      aria-label={`Foto ${i + 1}`}
                      onClick={() => setFoto(i)}
                      className={`h-1.5 cursor-pointer rounded-full transition-all ${
                        i === foto ? "w-5 bg-foreground" : "w-1.5 bg-foreground/30"
                      }`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {/* Informações */}
          <div className="flex flex-col gap-4 overflow-y-auto p-6 md:max-h-[80vh]">
            {/* Categoria + avaliações */}
            <div className="flex flex-wrap items-center gap-3">
              {product.categories?.nome ? (
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {product.categories.nome}
                </span>
              ) : null}
              {totalAval > 0 ? (
                <span className="flex items-center gap-1.5 text-sm">
                  <span className="tracking-tight">{"★".repeat(Math.round(mediaAval))}</span>
                  <span className="text-muted-foreground">
                    {mediaAval.toFixed(1)} · {totalAval} avaliação{totalAval > 1 ? "ões" : ""}
                  </span>
                </span>
              ) : null}
            </div>

            {/* Nome e preço */}
            <div>
              <h2 className="text-2xl font-semibold leading-tight">{product.nome}</h2>
              <div className="mt-3">
                {price ? (
                  <p className="flex items-baseline gap-3">
                    <span className="text-3xl font-semibold">{brl(Number(price.preco))}</span>
                    {price.preco_original ? (
                      <span className="text-sm text-muted-foreground line-through">
                        {brl(Number(price.preco_original))}
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Entre na sua conta para ver o preço</p>
                )}
              </div>
              {product.descricao ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{product.descricao}</p>
              ) : null}
            </div>

            {/* Seleção de numeração */}
            {variantes.length > 0 ? (
              <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900">
                <p className="text-sm font-semibold">Selecionar numeração</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Escolha o número para adicionar à sacola.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {variantes.map((v) => {
                    const semEstoque = v.estoque <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={semEstoque}
                        onClick={() => {
                          setAviso(null);
                          setTamanho(v.id);
                        }}
                        className={`min-w-11 cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
                          tamanho === v.id
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:border-foreground"
                        } ${semEstoque ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                      >
                        {v.tamanho}
                      </button>
                    );
                  })}
                </div>
                {aviso ? <p className="mt-2 text-xs text-destructive">{aviso}</p> : null}
              </div>
            ) : null}

            {/* Badges de confiança */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="size-4 shrink-0 text-foreground" />
                Garantia e compra segura
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Truck className="size-4 shrink-0 text-foreground" />
                Frete grátis acima de R$ 399
              </div>
            </div>

            {/* Botões */}
            <div className="mt-auto flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={adicionar}
                className="flex-1 cursor-pointer rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
              >
                {adicionado ? "Adicionado!" : signedIn ? "Adicionar à sacola" : "Entrar para comprar"}
              </button>
              <Link
                to="/produto/$slug"
                params={{ slug: product.slug }}
                onClick={onClose}
                className="flex-1 cursor-pointer rounded-full border border-border px-4 py-3 text-center text-sm font-semibold transition-colors hover:border-foreground hover:bg-muted"
              >
                Ver detalhes
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
