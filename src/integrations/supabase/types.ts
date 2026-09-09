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
          atualizado_em: string
          criado_em: string
          endereco: Json
          frete: number
          id: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          endereco?: Json
          frete?: number
          id?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          endereco?: Json
          frete?: number
          id?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          usuario_id?: string
        }
        Relationships: [
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
          criado_em: string
          email: string
          id: string
          nome: string
          sobrenome: string
        }
        Insert: {
          criado_em?: string
          email: string
          id: string
          nome: string
          sobrenome?: string
        }
        Update: {
          criado_em?: string
          email?: string
          id?: string
          nome?: string
          sobrenome?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_client_type: {
        Args: never
        Returns: Database["public"]["Enums"]["app_client_type"]
      }
    }
    Enums: {
      app_client_type: "varejo" | "atacado" | "dropshipping"
      app_role: "admin"
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
      app_client_type: ["varejo", "atacado", "dropshipping"],
      app_role: ["admin"],
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
