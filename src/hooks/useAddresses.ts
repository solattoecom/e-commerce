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

  const removeAddress = useCallback(async (id: string) => {
    if (!userId) return;
    const { error, count } = await supabase
      .from("addresses")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) { console.error("Erro ao remover endereço:", error); return; }
    if (count === 0) { console.warn("Nenhuma linha removida — verifique a política RLS de DELETE na tabela addresses no Supabase"); return; }
    await refresh();
  }, [userId, refresh]);

  return { addresses, loading, refresh, addAddress, setDefault, removeAddress };
}
