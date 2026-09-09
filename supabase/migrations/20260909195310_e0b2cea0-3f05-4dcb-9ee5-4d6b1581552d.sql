create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.my_client_type()
returns public.app_client_type
language sql stable set search_path = public
as $$
  select tipo from public.user_client_types where user_id = auth.uid()
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.my_client_type() from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.my_client_type() to authenticated;