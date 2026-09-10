import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/external";

export type Address = {
  id: string;
  user_id: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  padrao: boolean;
  criado_em: string;
};

export type NewAddress = Omit<Address, "id" | "user_id" | "criado_em">;

export function useAddresses(userId: string | null) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) { setAddresses([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("addresses")
      .select("*")
      .order("padrao", { ascending: false })
      .order("criado_em", { ascending: true });
    setAddresses((data as Address[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const addAddress = useCallback(async (addr: NewAddress) => {
    if (!userId) return;
    if (addr.padrao) {
      await supabase.from("addresses").update({ padrao: false }).eq("user_id", userId);
    }
    await supabase.from("addresses").insert({ ...addr, user_id: userId });
    await refresh();
  }, [userId, refresh]);

  const setDefault = useCallback(async (id: string) => {
    if (!userId) return;
    await supabase.from("addresses").update({ padrao: false }).eq("user_id", userId);
    await supabase.from("addresses").update({ padrao: true }).eq("id", id);
    await refresh();
  }, [userId, refresh]);

  const removeAddress = useCallback(async (id: string): Promise<string | null> => {
    if (!userId) return null;
    const { error } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", userId);
    if (error?.code === "23503") return "Este endereço está vinculado a pedidos e não pode ser removido.";
    if (error) return "Erro ao remover endereço.";
    await refresh();
    return null;
  }, [userId, refresh]);

  return { addresses, loading, refresh, addAddress, setDefault, removeAddress };
}
