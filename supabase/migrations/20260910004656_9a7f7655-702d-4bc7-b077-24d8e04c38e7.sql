-- user_roles: apenas admins podem gerenciar papéis
DROP POLICY IF EXISTS user_roles_admin_manage ON public.user_roles;
CREATE POLICY user_roles_admin_manage ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;

-- user_client_types: usuário só pode criar seu registro como varejo; alterações só por admin
DROP POLICY IF EXISTS client_types_insert_own ON public.user_client_types;
DROP POLICY IF EXISTS client_types_update_own ON public.user_client_types;
DROP POLICY IF EXISTS client_types_admin_manage ON public.user_client_types;

CREATE POLICY client_types_insert_own_varejo ON public.user_client_types
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND tipo = 'varejo'::app_client_type);

CREATE POLICY client_types_admin_manage ON public.user_client_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE UPDATE, DELETE ON public.user_client_types FROM authenticated;