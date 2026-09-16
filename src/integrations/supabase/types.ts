export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          bairro: string
          cep: string
          cidade: string
          complemento: string | null
          criado_em: string
          estado: string
          id: string
          numero: string
          padrao: boolean
          rua: string
          user_id: string
        }
        Insert: {
          bairro: string
          cep: string
          cidade: string
          complemento?: string | null
          criado_em?: string
          estado: string
          id?: string
          numero: string
          padrao?: boolean
          rua: string
          user_id: string
        }
        Update: {
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string | null
          criado_em?: string
          estado?: string
          id?: string
          numero?: string
          padrao?: boolean
          rua?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          produto_id: string
          quantidade: number
          usuario_id: string
          variacao_id: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          produto_id: string
          quantidade?: number
          usuario_id: string
          variacao_id?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          produto_id?: string
          quantidade?: number
          usuario_id?: string
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variacao_id_fkey"
            columns: ["variacao_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          imagem_url: string | null
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          id?: string
          imagem_url?: string | null
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          id?: string
          imagem_url?: string | null
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      client_type_requests: {
        Row: {
          criado_em: string
          decidido_em: string | null
          id: string
          status: string
          tipo_solicitado: Database["public"]["Enums"]["app_client_type"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          decidido_em?: string | null
          id?: string
          status?: string
          tipo_solicitado: Database["public"]["Enums"]["app_client_type"]
          user_id: string
        }
        Update: {
          criado_em?: string
          decidido_em?: string | null
          id?: string
          status?: string
          tipo_solicitado?: Database["public"]["Enums"]["app_client_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_type_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          criado_em: string
          expires_at: string | null
          id: string
          max_uses: number | null
          type: Database["public"]["Enums"]["coupon_type"]
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          criado_em?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          type: Database["public"]["Enums"]["coupon_type"]
          used_count?: number
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          criado_em?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          type?: Database["public"]["Enums"]["coupon_type"]
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          criado_em: string | null
          email: string
          id: string
        }
        Insert: {
          criado_em?: string | null
          email: string
          id?: string
        }
        Update: {
          criado_em?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          variacao_id: string | null
        }
        Insert: {
          id?: string
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          variacao_id?: string | null
        }
        Update: {
          id?: string
          pedido_id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variacao_id_fkey"
            columns: ["variacao_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_id: string | null
          atualizado_em: string
          card_parcelas: number | null
          codigo_rastreio: string | null
          comissao_percent: number
          comissao_valor: number
          coupon_id: string | null
          criado_em: string
          desconto: number
          endereco: Json
          frete: number
          id: string
          me_order_id: string | null
          me_service_id: number | null
          nota_fiscal: string | null
          payment_id: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          usuario_id: string
        }
        Insert: {
          address_id?: string | null
          atualizado_em?: string
          card_parcelas?: number | null
          codigo_rastreio?: string | null
          comissao_percent?: number
          comissao_valor?: number
          coupon_id?: string | null
          criado_em?: string
          desconto?: number
          endereco?: Json
          frete?: number
          id?: string
          me_order_id?: string | null
          me_service_id?: number | null
          nota_fiscal?: string | null
          payment_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          usuario_id: string
        }
        Update: {
          address_id?: string | null
          atualizado_em?: string
          card_parcelas?: number | null
          codigo_rastreio?: string | null
          comissao_percent?: number
          comissao_valor?: number
          coupon_id?: string | null
          criado_em?: string
          desconto?: number
          endereco?: Json
          frete?: number
          id?: string
          me_order_id?: string | null
          me_service_id?: number | null
          nota_fiscal?: string | null
          payment_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          id: string
          ordem: number
          produto_id: string
          url: string
        }
        Insert: {
          id?: string
          ordem?: number
          produto_id: string
          url: string
        }
        Update: {
          id?: string
          ordem?: number
          produto_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          id: string
          preco: number
          preco_original: number | null
          produto_id: string
          tipo: Database["public"]["Enums"]["app_client_type"]
        }
        Insert: {
          id?: string
          preco: number
          preco_original?: number | null
          produto_id: string
          tipo: Database["public"]["Enums"]["app_client_type"]
        }
        Update: {
          id?: string
          preco?: number
          preco_original?: number | null
          produto_id?: string
          tipo?: Database["public"]["Enums"]["app_client_type"]
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          atualizado_em: string
          autor_nome: string
          comentario: string | null
          criado_em: string
          id: string
          nota: number
          produto_id: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          autor_nome?: string
          comentario?: string | null
          criado_em?: string
          id?: string
          nota: number
          produto_id: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          autor_nome?: string
          comentario?: string | null
          criado_em?: string
          id?: string
          nota?: number
          produto_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          cor: string | null
          estoque: number
          id: string
          produto_id: string
          sku: string | null
          tamanho: string
        }
        Insert: {
          cor?: string | null
          estoque?: number
          id?: string
          produto_id: string
          sku?: string | null
          tamanho: string
        }
        Update: {
          cor?: string | null
          estoque?: number
          id?: string
          produto_id?: string
          sku?: string | null
          tamanho?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          slug: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          slug: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cpf: string | null
          criado_em: string
          email: string
          id: string
          nome: string
          sobrenome: string
        }
        Insert: {
          cpf?: string | null
          criado_em?: string
          email: string
          id: string
          nome: string
          sobrenome?: string
        }
        Update: {
          cpf?: string | null
          criado_em?: string
          email?: string
          id?: string
          nome?: string
          sobrenome?: string
        }
        Relationships: []
      }
      representantes: {
        Row: {
          atualizado_em: string
          cnpj: string | null
          comissao_percent: number
          criado_em: string
          modalidade: string
          razao_social: string | null
          status: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          cnpj?: string | null
          comissao_percent?: number
          criado_em?: string
          modalidade: string
          razao_social?: string | null
          status?: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          cnpj?: string | null
          comissao_percent?: number
          criado_em?: string
          modalidade?: string
          razao_social?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "representantes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alerts: {
        Row: {
          criado_em: string
          email: string
          id: string
          nome: string
          produto_id: string
          tamanho: string
        }
        Insert: {
          criado_em?: string
          email: string
          id?: string
          nome: string
          produto_id: string
          tamanho: string
        }
        Update: {
          criado_em?: string
          email?: string
          id?: string
          nome?: string
          produto_id?: string
          tamanho?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_client_types: {
        Row: {
          tipo: Database["public"]["Enums"]["app_client_type"]
          user_id: string
        }
        Insert: {
          tipo: Database["public"]["Enums"]["app_client_type"]
          user_id: string
        }
        Update: {
          tipo?: Database["public"]["Enums"]["app_client_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_client_types_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          criado_em: string
          id: string
          produto_id: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          produto_id: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          produto_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_stock: {
        Args: { p_quantidade: number; p_variacao_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_used_count: {
        Args: { p_coupon_id: string }
        Returns: undefined
      }
      my_client_type: {
        Args: never
        Returns: Database["public"]["Enums"]["app_client_type"]
      }
    }
    Enums: {
      app_client_type:
        | "varejo"
        | "atacado"
        | "dropshipping"
        | "atacado_presencial"
        | "atacado_distancia"
      app_role: "admin"
      coupon_type: "percent" | "fixed"
      order_status:
        | "pendente"
        | "pago"
        | "separando"
        | "enviado"
        | "entregue"
        | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_client_type: [
        "varejo",
        "atacado",
        "dropshipping",
        "atacado_presencial",
        "atacado_distancia",
      ],
      app_role: ["admin"],
      coupon_type: ["percent", "fixed"],
      order_status: [
        "pendente",
        "pago",
        "separando",
        "enviado",
        "entregue",
        "cancelado",
      ],
    },
  },
} as const
