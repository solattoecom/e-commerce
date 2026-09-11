import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/external";

export type WishlistItem = {
  id: string;
  produto_id: string;
  products: {
    nome: string;
    descricao: string | null;
    product_images: { url: string; ordem: number }[];
    product_prices: { preco: number; preco_original: number | null }[];
  } | null;
};

export function useWishlist(userId: string | null) {
  const [items, setItems] = useState<WishlistItem[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    const { data } = await supabase
      .from("wishlist_items")
      .select(
        "id, produto_id, products(nome, descricao, product_images(url, ordem), product_prices(preco, preco_original))",
      )
      .order("criado_em", { ascending: false });
    setItems((data as unknown as WishlistItem[]) ?? []);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (produtoId: string) => {
      if (!userId) return;
      const existing = items.find((item) => item.produto_id === produtoId);
      if (existing) {
        await supabase.from("wishlist_items").delete().eq("id", existing.id);
      } else {
        await supabase
          .from("wishlist_items")
          .insert({ usuario_id: userId, produto_id: produtoId });
      }
      await refresh();
    },
    [items, refresh, userId],
  );

  const removeItem = useCallback(
    async (id: string) => {
      await supabase.from("wishlist_items").delete().eq("id", id);
      await refresh();
    },
    [refresh],
  );

  const ids = new Set(items.map((item) => item.produto_id));

  return { items, ids, count: items.length, toggle, removeItem, refresh };
}
