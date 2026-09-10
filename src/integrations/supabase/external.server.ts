// Cliente administrativo do Supabase próprio da loja (uso exclusivo no servidor).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { EXTERNAL_SUPABASE_URL, createSupabaseFetch } from './external';

function createExternalAdminClient() {
  const key = process.env['EXTERNAL_SUPABASE_SERVICE_ROLE_KEY'];
  if (!key) {
    throw new Error(
      'Falta a chave secreta do Supabase da loja (EXTERNAL_SUPABASE_SERVICE_ROLE_KEY).',
    );
  }

  return createClient<Database>(EXTERNAL_SUPABASE_URL, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let _admin: ReturnType<typeof createExternalAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createExternalAdminClient>, {
  get(_, prop, receiver) {
    if (!_admin) _admin = createExternalAdminClient();
    return Reflect.get(_admin, prop, receiver);
  },
});
