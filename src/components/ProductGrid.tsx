import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type Product = {
  id: string;
  nome: string;
  descricao: string | null;
  categories: { nome: string } | null;
  product_images: { url: string; ordem: number }[];
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
  onAdd?: (produtoId: string) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const columns = signedIn
      ? "id, nome, descricao, categories(nome), product_images(url, ordem), product_prices(preco, preco_original)"
      : "id, nome, descricao, categories(nome), product_images(url, ordem)";
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
                <button
                  type="button"
                  onClick={() => onAdd?.(product.id)}
                  className="mt-3 w-full cursor-pointer rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
                >
                  {signedIn ? "Adicionar à sacola" : "Entrar para comprar"}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
