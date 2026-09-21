import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/external";

export type ClientType = "varejo" | "dropshipping";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientType, setClientType] = useState<ClientType | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession?.user) setClientType(null);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) { setClientType(null); return; }
    void supabase
      .from("user_client_types")
      .select("tipo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setClientType((data?.tipo as ClientType) ?? "varejo");
      });
  }, [user?.id]);

  return { session, user, loading, clientType };
}

export async function signUpWithType(params: {
  nome: string;
  email: string;
  senha: string;
  tipo: ClientType;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.senha,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: { nome: params.nome, tipo: params.tipo },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, senha: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}
