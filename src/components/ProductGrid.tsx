import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/external";

type Product = {
  id: string;
  nome: string;
  slug: string;
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
  filterSize,
  onAdd,
  wishlistIds = new Set(),
  onToggleWishlist,
}: {
  signedIn: boolean;
  refreshKey?: number;
  search?: string;
  filterSize?: string;
  onAdd?: (produtoId: string, variacaoId: string | null) => void;
  wishlistIds?: Set<string>;
  onToggleWishlist?: (produtoId: string) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sizeByProduct, setSizeByProduct] = useState<Record<string, string>>({});
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [slideByProduct, setSlideByProduct] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    const columns = signedIn
      ? "id, nome, slug, descricao, categories(nome), product_images(url, ordem), product_variants(id, tamanho, estoque), product_prices(preco, preco_original)"
      : "id, nome, slug, descricao, categories(nome), product_images(url, ordem), product_variants(id, tamanho, estoque)";
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
  const porBusca = termo
    ? products.filter((product) =>
        `${product.nome} ${product.descricao ?? ""} ${product.categories?.nome ?? ""}`
          .toLowerCase()
          .includes(termo),
      )
    : products;

  const visiveis = filterSize
    ? porBusca.filter((product) =>
        product.product_variants.some(
          (v) => v.tamanho === filterSize && v.estoque > 0,
        ),
      )
    : porBusca;

  if (visiveis.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        {termo
          ? `Nenhum calçado encontrado para "${search.trim()}".`
          : filterSize
            ? `Nenhum calçado disponível no número ${filterSize}.`
            : "Nenhum calçado disponível no momento."}
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {visiveis.map((product) => {
        const imagens = [...product.product_images].sort((a, b) => a.ordem - b.ordem);
        const total = imagens.length;
        const atual = total > 0 ? ((slideByProduct[product.id] ?? 0) % total + total) % total : 0;
        const mover = (passo: number) =>
          setSlideByProduct((prev) => ({ ...prev, [product.id]: (prev[product.id] ?? 0) + passo }));
        const price = product.product_prices[0];
        return (
          <article key={product.id} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background">
            <div
              className="relative aspect-square bg-background"
              onTouchStart={(e) => {
                (e.currentTarget as HTMLDivElement).dataset.touchX = String(e.touches[0].clientX);
              }}
              onTouchEnd={(e) => {
                const startX = Number((e.currentTarget as HTMLDivElement).dataset.touchX ?? 0);
                const diff = startX - e.changedTouches[0].clientX;
                if (Math.abs(diff) > 40) mover(diff > 0 ? 1 : -1);
              }}
            >
              <Link to="/produto/$slug" params={{ slug: product.slug }} className="absolute inset-0 z-0" aria-label={`Ver detalhes de ${product.nome}`} />
              {imagens.map((img, i) => (
                <img
                  key={img.url}
                  src={img.url}
                  alt={`${product.nome} — foto ${i + 1}`}
                  loading="lazy"
                  className={`pointer-events-none absolute inset-0 h-full w-full object-contain object-center transition-opacity duration-300 ${
                    i === atual ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
              {total > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Foto anterior"
                    onClick={() => mover(-1)}
                    className="absolute left-3 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-full border border-border bg-background/80 px-3 py-2 text-sm backdrop-blur transition-opacity hover:bg-background"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Próxima foto"
                    onClick={() => mover(1)}
                    className="absolute right-3 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-full border border-border bg-background/80 px-3 py-2 text-sm backdrop-blur transition-opacity hover:bg-background"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5">
                    {imagens.map((img, i) => (
                      <button
                        key={`dot-${img.url}`}
                        type="button"
                        aria-label={`Ver foto ${i + 1}`}
                        onClick={() => setSlideByProduct((prev) => ({ ...prev, [product.id]: i }))}
                        className={`h-1.5 cursor-pointer rounded-full transition-all ${
                          i === atual ? "w-5 bg-foreground" : "w-1.5 bg-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{product.categories?.nome}</p>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold">{product.nome}</h3>
                {onToggleWishlist ? (
                  <button
                    type="button"
                    aria-label={wishlistIds.has(product.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    onClick={() => onToggleWishlist(product.id)}
                    className="mt-0.5 shrink-0 cursor-pointer rounded-full p-1 text-foreground transition-colors hover:bg-muted"
                  >
                    <Heart
                      className="size-5"
                      fill={wishlistIds.has(product.id) ? "currentColor" : "none"}
                    />
                  </button>
                ) : null}
              </div>

              <div className="mt-auto pt-3">
                {price ? (
                  <div>
                    <p className="flex items-baseline gap-2">
                      <span className="text-xl font-semibold">{brl(Number(price.preco))}</span>
                      {price.preco_original ? (
                        <span className="text-sm text-muted-foreground line-through">{brl(Number(price.preco_original))}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">ou 10x de {brl(Number(price.preco) / 10)}</p>
                  </div>
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
                {product.product_variants.length > 0 && product.product_variants.every((v) => v.estoque <= 0) ? (
                  <div className="mt-3 w-full rounded-full border border-border px-4 py-2.5 text-center text-sm font-semibold text-muted-foreground">
                    Esgotado
                  </div>
                ) : (
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
                )}
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
