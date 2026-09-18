// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          amount_cents: number
          category_id: string
          created_at: string
          family_id: string
          id: string
          month: string
        }
        Insert: {
          amount_cents: number
          category_id: string
          created_at?: string
          family_id: string
          id?: string
          month: string
        }
        Update: {
          amount_cents?: number
          category_id?: string
          created_at?: string
          family_id?: string
          id?: string
          month?: string
        }
        Relationships: [
          {
            foreignKeyName: 'budgets_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'transaction_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'budgets_family_id_fkey'
            columns: ['family_id']
            isOneToOne: false
            referencedRelation: 'families'
            referencedColumns: ['id']
          },
        ]
      }
      families: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          created_at: string
          family_id: string
          id: string
          is_admin: boolean
          name: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          is_admin?: boolean
          name: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          is_admin?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'family_members_family_id_fkey'
            columns: ['family_id']
            isOneToOne: false
            referencedRelation: 'families'
            referencedColumns: ['id']
          },
        ]
      }
      goals: {
        Row: {
          category_id: string | null
          created_at: string
          deadline: string
          family_id: string
          id: string
          name: string
          target_amount_cents: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          deadline: string
          family_id: string
          id?: string
          name: string
          target_amount_cents: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          deadline?: string
          family_id?: string
          id?: string
          name?: string
          target_amount_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: 'goals_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'transaction_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'goals_family_id_fkey'
            columns: ['family_id']
            isOneToOne: false
            referencedRelation: 'families'
            referencedColumns: ['id']
          },
        ]
      }
      investments: {
        Row: {
          asset_type: Database['public']['Enums']['asset_type']
          avg_price_cents: number
          created_at: string
          current_price_cents: number
          family_id: string
          id: string
          name: string
          quantity: number
          ticker: string | null
        }
        Insert: {
          asset_type?: Database['public']['Enums']['asset_type']
          avg_price_cents?: number
          created_at?: string
          current_price_cents?: number
          family_id: string
          id?: string
          name: string
          quantity?: number
          ticker?: string | null
        }
        Update: {
          asset_type?: Database['public']['Enums']['asset_type']
          avg_price_cents?: number
          created_at?: string
          current_price_cents?: number
          family_id?: string
          id?: string
          name?: string
          quantity?: number
          ticker?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'investments_family_id_fkey'
            columns: ['family_id']
            isOneToOne: false
            referencedRelation: 'families'
            referencedColumns: ['id']
          },
        ]
      }
      transaction_categories: {
        Row: {
          color: string | null
          created_at: string
          family_id: string | null
          icon: string | null
          id: string
          name: string
          type: Database['public']['Enums']['transaction_type']
        }
        Insert: {
          color?: string | null
          created_at?: string
          family_id?: string | null
          icon?: string | null
          id?: string
          name: string
          type?: Database['public']['Enums']['transaction_type']
        }
        Update: {
          color?: string | null
          created_at?: string
          family_id?: string | null
          icon?: string | null
          id?: string
          name?: string
          type?: Database['public']['Enums']['transaction_type']
        }
        Relationships: [
          {
            foreignKeyName: 'transaction_categories_family_id_fkey'
            columns: ['family_id']
            isOneToOne: false
            referencedRelation: 'families'
            referencedColumns: ['id']
          },
        ]
      }
      transactions: {
        Row: {
          amount_cents: number
          category_id: string | null
          created_at: string
          description: string | null
          family_id: string
          id: string
          member_id: string
          transaction_date: string
          type: Database['public']['Enums']['transaction_type']
        }
        Insert: {
          amount_cents: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          family_id: string
          id?: string
          member_id: string
          transaction_date?: string
          type: Database['public']['Enums']['transaction_type']
        }
        Update: {
          amount_cents?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          family_id?: string
          id?: string
          member_id?: string
          transaction_date?: string
          type?: Database['public']['Enums']['transaction_type']
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'transaction_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_family_id_fkey'
            columns: ['family_id']
            isOneToOne: false
            referencedRelation: 'families'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'family_members'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      asset_type: 'stock' | 'fii' | 'fixed_income' | 'crypto' | 'treasury' | 'other'
      transaction_type: 'income' | 'expense'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      asset_type: ['stock', 'fii', 'fixed_income', 'crypto', 'treasury', 'other'],
      transaction_type: ['income', 'expense'],
    },
  },
} as const
