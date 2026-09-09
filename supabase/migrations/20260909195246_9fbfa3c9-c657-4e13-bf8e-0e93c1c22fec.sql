-- ========== ENUMS ==========
create type public.app_client_type as enum ('varejo','atacado','dropshipping');
create type public.app_role as enum ('admin');
create type public.order_status as enum ('pendente','pago','separando','enviado','entregue','cancelado');

-- ========== PROFILES ==========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  sobrenome text not null default '',
  email text not null,
  criado_em timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ========== USER ROLES (admin) ==========
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- ========== CLIENT TYPES (varejo / atacado / dropshipping) ==========
create table public.user_client_types (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tipo public.app_client_type not null
);
GRANT SELECT, INSERT, UPDATE ON public.user_client_types TO authenticated;
GRANT ALL ON public.user_client_types TO service_role;
ALTER TABLE public.user_client_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_types_select_own" ON public.user_client_types FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "client_types_insert_own" ON public.user_client_types FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "client_types_update_own" ON public.user_client_types FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

create or replace function public.my_client_type()
returns public.app_client_type
language sql stable security definer set search_path = public
as $$
  select tipo from public.user_client_types where user_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.my_client_type() TO authenticated;

-- ========== CATEGORIES ==========
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  imagem_url text,
  ordem int not null default 0
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories_admin_write" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== PRODUCTS ==========
create table public.products (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  descricao text,
  categoria_id uuid references public.categories(id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_read_active" ON public.products FOR SELECT TO anon, authenticated USING (ativo = true);
CREATE POLICY "products_admin_read_all" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "products_admin_write" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== PRODUCT IMAGES ==========
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  ordem int not null default 0
);
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "images_public_read" ON public.product_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "images_admin_write" ON public.product_images FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== PRODUCT VARIANTS ==========
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.products(id) on delete cascade,
  tamanho text not null,
  cor text,
  sku text unique,
  estoque int not null default 0 check (estoque >= 0)
);
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variants_public_read" ON public.product_variants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "variants_admin_write" ON public.product_variants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== PRODUCT PRICES (3 tabelas de preço) ==========
create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.products(id) on delete cascade,
  tipo public.app_client_type not null,
  preco numeric(10,2) not null check (preco >= 0),
  preco_original numeric(10,2) check (preco_original is null or preco_original >= 0),
  unique (produto_id, tipo)
);
GRANT SELECT ON public.product_prices TO authenticated;
GRANT ALL ON public.product_prices TO service_role;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prices_read_own_type" ON public.product_prices FOR SELECT TO authenticated USING (tipo = public.my_client_type() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "prices_admin_write" ON public.product_prices FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== ORDERS ==========
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete restrict,
  status public.order_status not null default 'pendente',
  subtotal numeric(10,2) not null default 0 check (subtotal >= 0),
  frete numeric(10,2) not null default 0 check (frete >= 0),
  total numeric(10,2) not null default 0 check (total >= 0),
  endereco jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_own" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "orders_insert_own" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "orders_admin_read_all" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "orders_admin_update" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== ORDER ITEMS ==========
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.orders(id) on delete cascade,
  produto_id uuid not null references public.products(id) on delete restrict,
  variacao_id uuid references public.product_variants(id) on delete set null,
  quantidade int not null check (quantidade > 0),
  preco_unitario numeric(10,2) not null check (preco_unitario >= 0),
  subtotal numeric(10,2) not null check (subtotal >= 0)
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_select_own" ON public.order_items FOR SELECT TO authenticated USING (exists (select 1 from public.orders o where o.id = pedido_id and o.usuario_id = auth.uid()));
CREATE POLICY "items_insert_own" ON public.order_items FOR INSERT TO authenticated WITH CHECK (exists (select 1 from public.orders o where o.id = pedido_id and o.usuario_id = auth.uid()));
CREATE POLICY "items_admin_read_all" ON public.order_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ========== TRIGGER updated_at em pedidos ==========
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;
create trigger update_orders_updated_at before update on public.orders
for each row execute function public.update_updated_at_column();