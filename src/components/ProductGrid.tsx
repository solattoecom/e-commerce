import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type Product = {
  id: string;
  nome: string;
  descricao: string | null;
  categories: { nome: string } | null;
  product_images: { url: string; ordem: number }[];
  product_variants: { id: string; tamanho: string; estoque: number }[];
  product_prices: { preco: number; preco_original: number | null }[];
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ProductGrid({
  signedIn,
  refreshKey = 0,
  search = "",
  onAdd,
}: {
  signedIn: boolean;
  refreshKey?: number;
  search?: string;
  onAdd?: (produtoId: string, variacaoId: string | null) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sizeByProduct, setSizeByProduct] = useState<Record<string, string>>({});
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [slideByProduct, setSlideByProduct] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    const columns = signedIn
      ? "id, nome, descricao, categories(nome), product_images(url, ordem), product_variants(id, tamanho, estoque), product_prices(preco, preco_original)"
      : "id, nome, descricao, categories(nome), product_images(url, ordem), product_variants(id, tamanho, estoque)";
    supabase
      .from("products")
      .select(columns)
      .eq("ativo", true)
      .order("criado_em", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("Falha ao carregar produtos", error);
        const rows = ((data as unknown as Product[]) ?? []).map((p) => ({
          ...p,
          product_images: p.product_images ?? [],
          product_variants: [...(p.product_variants ?? [])].sort((a, b) =>
            a.tamanho.localeCompare(b.tamanho, "pt-BR", { numeric: true }),
          ),
          product_prices: p.product_prices ?? [],
        }));
        setProducts(rows);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [signedIn, refreshKey]);

  if (loading) {
    return <p className="text-center text-sm text-muted-foreground">Carregando produtos…</p>;
  }

  if (products.length === 0) {
    return <p className="text-center text-sm text-muted-foreground">Nenhum produto disponível no momento.</p>;
  }

  const termo = search.trim().toLowerCase();
  const visiveis = termo
    ? products.filter((product) =>
        `${product.nome} ${product.descricao ?? ""} ${product.categories?.nome ?? ""}`
          .toLowerCase()
          .includes(termo),
      )
    : products;

  if (visiveis.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Nenhum calçado encontrado para “{search.trim()}”.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {visiveis.map((product) => {
        const image = [...product.product_images].sort((a, b) => a.ordem - b.ordem)[0];
        const price = product.product_prices[0];
        return (
          <article key={product.id} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background">
            <div className="aspect-square bg-[#F5EFE6]">
              {image ? (
                <img src={image.url} alt={product.nome} loading="lazy" className="h-full w-full object-contain object-center" />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{product.categories?.nome}</p>
              <h3 className="text-lg font-semibold">{product.nome}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{product.descricao}</p>
              <div className="mt-auto pt-3">
                {price ? (
                  <p className="flex items-baseline gap-2">
                    <span className="text-xl font-semibold">{brl(Number(price.preco))}</span>
                    {price.preco_original ? (
                      <span className="text-sm text-muted-foreground line-through">{brl(Number(price.preco_original))}</span>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Entre na sua conta para ver o preço</p>
                )}
                {product.product_variants.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Numeração</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {product.product_variants.map((variant) => {
                        const selecionado = sizeByProduct[product.id] === variant.id;
                        const semEstoque = variant.estoque <= 0;
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            disabled={semEstoque}
                            onClick={() => {
                              setSizeError(null);
                              setSizeByProduct((prev) => ({ ...prev, [product.id]: variant.id }));
                            }}
                            className={`min-w-11 cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors ${
                              selecionado
                                ? "border-foreground bg-foreground text-background"
                                : "border-border hover:border-foreground"
                            } ${semEstoque ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                          >
                            {variant.tamanho}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    const escolhido = sizeByProduct[product.id] ?? null;
                    if (signedIn && product.product_variants.length > 0 && !escolhido) {
                      setSizeError(product.id);
                      return;
                    }
                    setSizeError(null);
                    onAdd?.(product.id, escolhido);
                  }}
                  className="mt-3 w-full cursor-pointer rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
                >
                  {signedIn ? "Adicionar à sacola" : "Entrar para comprar"}
                </button>
                {sizeError === product.id ? (
                  <p className="mt-2 text-xs text-destructive">Escolha a numeração antes de adicionar.</p>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
