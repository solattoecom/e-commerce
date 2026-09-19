-- Marca se o usuário já passou explicitamente pela tela de seleção de tipo de conta.
-- Evita mostrar a tela de novo em logins subsequentes via Google OAuth.
ALTER TABLE public.user_client_types
  ADD COLUMN IF NOT EXISTS tipo_confirmado boolean NOT NULL DEFAULT false;
