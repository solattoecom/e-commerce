-- Coluna para rastrear envio de e-mail de expiração (evita duplicatas)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz;
