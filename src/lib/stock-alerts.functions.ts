import { createServerFn } from "@tanstack/react-start";

type CadastrarAlertaInput = {
  produto_id: string;
  tamanho: string;
  nome: string;
  email: string;
};

export const cadastrarAlertaEstoque = createServerFn({ method: "POST" })
  .inputValidator((input: CadastrarAlertaInput) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/external.server");
    const { error } = await (supabaseAdmin.from as never as (t: string) => ReturnType<typeof supabaseAdmin.from>)("stock_alerts")
      .upsert(
        { produto_id: data.produto_id, tamanho: data.tamanho, nome: data.nome, email: data.email },
        { onConflict: "produto_id,tamanho,email" },
      );
    if (error) throw new Error(error.message);
  });
