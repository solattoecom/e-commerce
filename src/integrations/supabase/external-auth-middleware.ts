// Valida o usuário logado no Supabase próprio da loja, dentro de server functions.
import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import {
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
  createSupabaseFetch,
} from './external';

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest();
    const authHeader = request?.headers?.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Unauthorized: No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token || token.split('.').length !== 3) {
      throw new Error('Unauthorized: Invalid token');
    }

    const supabase = createClient<Database>(
      EXTERNAL_SUPABASE_URL,
      EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          fetch: createSupabaseFetch(EXTERNAL_SUPABASE_PUBLISHABLE_KEY),
          headers: { Authorization: `Bearer ${token}` },
        },
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      },
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      throw new Error('Unauthorized: Invalid token');
    }

    return next({
      context: { supabase, userId: user.id, claims: user },
    });
  },
);
