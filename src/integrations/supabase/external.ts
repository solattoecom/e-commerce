// Cliente do Supabase próprio da loja (mesmo banco usado pelo site na Vercel).
// Não usa o banco criado dentro do Lovable.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const EXTERNAL_SUPABASE_URL = 'https://libqhyxxkpjvtuzpdsnb.supabase.co';
export const EXTERNAL_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_s1PcCqmg4cJlL3_5oWJZZA_8wvHN2Ae';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

export function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // As novas chaves do Supabase são opacas, não são JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createExternalClient() {
  return createClient<Database>(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: createSupabaseFetch(EXTERNAL_SUPABASE_PUBLISHABLE_KEY) },
    auth: {
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: typeof window !== 'undefined',
    },
  });
}

let _client: ReturnType<typeof createExternalClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createExternalClient>, {
  get(_, prop, receiver) {
    if (!_client) _client = createExternalClient();
    return Reflect.get(_client, prop, receiver);
  },
});
