import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type CartItem = {
  id: string;
  produto_id: string;
  variacao_id: string | null;
  quantidade: number;
  product_variants: { tamanho: string } | null;
  products: {
    nome: string;
    product_images: { url: string; ordem: number }[];
    product_prices: { preco: number }[];
  } | null;
};

export function useCart(userId: string | null) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("cart_items")
      .select(
        "id, produto_id, variacao_id, quantidade, product_variants(tamanho), products(nome, product_images(url, ordem), product_prices(preco))",
      )
      .order("criado_em", { ascending: true });
    setItems((data as unknown as CartItem[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (produtoId: string) => {
      if (!userId) return false;
      const existing = items.find((item) => item.produto_id === produtoId);
      if (existing) {
        await supabase
          .from("cart_items")
          .update({ quantidade: existing.quantidade + 1 })
          .eq("id", existing.id);
      } else {
        await supabase.from("cart_items").insert({ usuario_id: userId, produto_id: produtoId, quantidade: 1 });
      }
      await refresh();
      return true;
    },
    [items, refresh, userId],
  );

  const setQuantity = useCallback(
    async (id: string, quantidade: number) => {
      if (quantidade <= 0) {
        await supabase.from("cart_items").delete().eq("id", id);
      } else {
        await supabase.from("cart_items").update({ quantidade }).eq("id", id);
      }
      await refresh();
    },
    [refresh],
  );

  const removeItem = useCallback(
    async (id: string) => {
      await supabase.from("cart_items").delete().eq("id", id);
      await refresh();
    },
    [refresh],
  );

  const count = items.reduce((total, item) => total + item.quantidade, 0);
  const total = items.reduce(
    (sum, item) => sum + (item.products?.product_prices?.[0]?.preco ?? 0) * item.quantidade,
    0,
  );

  return { items, count, total, loading, addItem, setQuantity, removeItem, refresh };
}
