// Anexa o token do usuário (Supabase da loja) às chamadas de server functions.
import { createMiddleware } from '@tanstack/react-start';
import { supabase } from './external';

export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
