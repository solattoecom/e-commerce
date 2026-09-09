import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type ClientType = "varejo" | "atacado" | "dropshipping";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}

export async function signUpWithType(params: {
  nome: string;
  sobrenome: string;
  email: string;
  senha: string;
  tipo: ClientType;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.senha,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: { nome: params.nome, sobrenome: params.sobrenome, tipo: params.tipo },
    },
  });
  if (error) throw error;

  const userId = data.user?.id;
  if (userId && data.session) {
    await supabase.from("profiles").upsert({
      id: userId,
      nome: params.nome,
      sobrenome: params.sobrenome,
      email: params.email,
    });
    await supabase.from("user_client_types").upsert({ user_id: userId, tipo: params.tipo });
  }
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
