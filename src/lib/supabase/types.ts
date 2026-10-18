// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ai_rate_limits: {
        Row: {
          function_name: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          function_name: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          function_name?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      backup_20261011_budgets: {
        Row: {
          amount_cents: number | null
          category_id: string | null
          created_at: string | null
          family_id: string | null
          id: string | null
          month: string | null
          subcategory_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          category_id?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string | null
          month?: string | null
          subcategory_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          category_id?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string | null
          month?: string | null
          subcategory_id?: string | null
        }
        Relationships: []
      }
      backup_20261011_categorization_rules: {
        Row: {
          category_id: string | null
          created_at: string | null
          family_id: string | null
          id: string | null
          pattern: string | null
          subcategory_id: string | null
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string | null
          pattern?: string | null
          subcategory_id?: string | null
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string | null
          pattern?: string | null
          subcategory_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_20261011_copilot_messages: {
        Row: {
          card_type: string | null
          content: string | null
          created_at: string | null
          family_id: string | null
          id: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          card_type?: string | null
          content?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          card_type?: string | null
          content?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_20261011_default_budgets: {
        Row: {
          amount_cents: number | null
          category_id: string | null
          created_at: string | null
          family_id: string | null
          id: string | null
          subcategory_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          category_id?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string | null
          subcategory_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          category_id?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string | null
          subcategory_id?: string | null
        }
        Relationships: []
      }
      backup_20261011_families: {
        Row: {
          avatar_url: string | null
          budget_model: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          monthly_net_income_cents: number | null
          name: string | null
        }
        Insert: {
          avatar_url?: string | null
          budget_model?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          monthly_net_income_cents?: number | null
          name?: string | null
        }
        Update: {
          avatar_url?: string | null
          budget_model?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          monthly_net_income_cents?: number | null
          name?: string | null
        }
        Relationships: []
      }
      backup_20261011_family_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          code: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          family_id: string | null
          id: string | null
          max_uses: number | null
          role: string | null
          status: string | null
          uses_count: number | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          family_id?: string | null
          id?: string | null
          max_uses?: number | null
          role?: string | null
          status?: string | null
          uses_count?: number | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          family_id?: string | null
          id?: string | null
          max_uses?: number | null
          role?: string | null
          status?: string | null
          uses_count?: number | null
        }
        Relationships: []
      }
      backup_20261011_family_members: {
        Row: {
          created_at: string | null
          family_id: string | null
          id: string | null
          is_admin: boolean | null
          name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          family_id?: string | null
          id?: string | null
          is_admin?: boolean | null
          name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          family_id?: string | null
          id?: string | null
          is_admin?: boolean | null
          name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_20261011_goals: {
        Row: {
          category_id: string | null
          created_at: string | null
          deadline: string | null
          family_id: string | null
          id: string | null
          name: string | null
          target_amount_cents: number | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          deadline?: string | null
          family_id?: string | null
          id?: string | null
          name?: string | null
          target_amount_cents?: number | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          deadline?: string | null
          family_id?: string | null
          id?: string | null
          name?: string | null
          target_amount_cents?: number | null
        }
        Relationships: []
      }
      backup_20261011_investments: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"] | null
          avg_price_cents: number | null
          created_at: string | null
          current_price_cents: number | null
          family_id: string | null
          id: string | null
          name: string | null
          quantity: number | null
          ticker: string | null
        }
        Insert: {
          asset_type?: Database["public"]["Enums"]["asset_type"] | null
          avg_price_cents?: number | null
          created_at?: string | null
          current_price_cents?: number | null
          family_id?: string | null
          id?: string | null
          name?: string | null
          quantity?: number | null
          ticker?: string | null
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"] | null
          avg_price_cents?: number | null
          created_at?: string | null
          current_price_cents?: number | null
          family_id?: string | null
          id?: string | null
          name?: string | null
          quantity?: number | null
          ticker?: string | null
        }
        Relationships: []
      }
      backup_20261011_recurring_income_overrides: {
        Row: {
          amount_cents: number | null
          created_at: string | null
          family_id: string | null
          id: string | null
          month: string | null
          recurring_income_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string | null
          family_id?: string | null
          id?: string | null
          month?: string | null
          recurring_income_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string | null
          family_id?: string | null
          id?: string | null
          month?: string | null
          recurring_income_id?: string | null
        }
        Relationships: []
      }
      backup_20261011_recurring_incomes: {
        Row: {
          active: boolean | null
          amount_cents: number | null
          category_id: string | null
          created_at: string | null
          day_of_month: number | null
          family_id: string | null
          id: string | null
          member_id: string | null
          name: string | null
          subcategory_id: string | null
          type: Database["public"]["Enums"]["transaction_type"] | null
        }
        Insert: {
          active?: boolean | null
          amount_cents?: number | null
          category_id?: string | null
          created_at?: string | null
          day_of_month?: number | null
          family_id?: string | null
          id?: string | null
          member_id?: string | null
          name?: string | null
          subcategory_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"] | null
        }
        Update: {
          active?: boolean | null
          amount_cents?: number | null
          category_id?: string | null
          created_at?: string | null
          day_of_month?: number | null
          family_id?: string | null
          id?: string | null
          member_id?: string | null
          name?: string | null
          subcategory_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"] | null
        }
        Relationships: []
      }
      backup_20261011_transaction_categories: {
        Row: {
          budget_bucket: string | null
          color: string | null
          created_at: string | null
          family_id: string | null
          icon: string | null
          id: string | null
          name: string | null
          percent_alert: number | null
          percent_default: number | null
          sort_order: number | null
          type: Database["public"]["Enums"]["transaction_type"] | null
        }
        Insert: {
          budget_bucket?: string | null
          color?: string | null
          created_at?: string | null
          family_id?: string | null
          icon?: string | null
          id?: string | null
          name?: string | null
          percent_alert?: number | null
          percent_default?: number | null
          sort_order?: number | null
          type?: Database["public"]["Enums"]["transaction_type"] | null
        }
        Update: {
          budget_bucket?: string | null
          color?: string | null
          created_at?: string | null
          family_id?: string | null
          icon?: string | null
          id?: string | null
          name?: string | null
          percent_alert?: number | null
          percent_default?: number | null
          sort_order?: number | null
          type?: Database["public"]["Enums"]["transaction_type"] | null
        }
        Relationships: []
      }
      backup_20261011_transaction_subcategories: {
        Row: {
          category_id: string | null
          color: string | null
          created_at: string | null
          family_id: string | null
          icon: string | null
          id: string | null
          name: string | null
          sort_order: number | null
        }
        Insert: {
          category_id?: string | null
          color?: string | null
          created_at?: string | null
          family_id?: string | null
          icon?: string | null
          id?: string | null
          name?: string | null
          sort_order?: number | null
        }
        Update: {
          category_id?: string | null
          color?: string | null
          created_at?: string | null
          family_id?: string | null
          icon?: string | null
          id?: string | null
          name?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      backup_20261011_transactions: {
        Row: {
          ai_confidence: number | null
          amount_cents: number | null
          bank_transaction_id: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          family_id: string | null
          id: string | null
          installment_group_id: string | null
          installment_number: number | null
          installment_total: number | null
          is_installment: boolean | null
          is_recurring: boolean | null
          member_id: string | null
          payment_method: string | null
          recurring_income_id: string | null
          recurring_month: string | null
          status: string | null
          subcategory_id: string | null
          transaction_date: string | null
          type: Database["public"]["Enums"]["transaction_type"] | null
        }
        Insert: {
          ai_confidence?: number | null
          amount_cents?: number | null
          bank_transaction_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          family_id?: string | null
          id?: string | null
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_installment?: boolean | null
          is_recurring?: boolean | null
          member_id?: string | null
          payment_method?: string | null
          recurring_income_id?: string | null
          recurring_month?: string | null
          status?: string | null
          subcategory_id?: string | null
          transaction_date?: string | null
          type?: Database["public"]["Enums"]["transaction_type"] | null
        }
        Update: {
          ai_confidence?: number | null
          amount_cents?: number | null
          bank_transaction_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          family_id?: string | null
          id?: string | null
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_installment?: boolean | null
          is_recurring?: boolean | null
          member_id?: string | null
          payment_method?: string | null
          recurring_income_id?: string | null
          recurring_month?: string | null
          status?: string | null
          subcategory_id?: string | null
          transaction_date?: string | null
          type?: Database["public"]["Enums"]["transaction_type"] | null
        }
        Relationships: []
      }
      backup_20261011_user_preferences: {
        Row: {
          ai_consent: boolean | null
          ai_consent_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_consent?: boolean | null
          ai_consent_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_consent?: boolean | null
          ai_consent_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_20261011_users: {
        Row: {
          banned_until: string | null
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          email_change: string | null
          email_change_confirm_status: number | null
          email_change_sent_at: string | null
          email_change_token_current: string | null
          email_change_token_new: string | null
          email_confirmed_at: string | null
          encrypted_password: string | null
          id: string | null
          instance_id: string | null
          invited_at: string | null
          is_anonymous: boolean | null
          is_sso_user: boolean | null
          is_super_admin: boolean | null
          last_sign_in_at: string | null
          phone: string | null
          phone_change: string | null
          phone_change_sent_at: string | null
          phone_change_token: string | null
          phone_confirmed_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          reauthentication_sent_at: string | null
          reauthentication_token: string | null
          recovery_sent_at: string | null
          recovery_token: string | null
          updated_at: string | null
        }
        Insert: {
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id?: string | null
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean | null
          is_sso_user?: boolean | null
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          updated_at?: string | null
        }
        Update: {
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id?: string | null
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean | null
          is_sso_user?: boolean | null
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount_cents: number
          category_id: string
          created_at: string
          family_id: string
          id: string
          month: string
          subcategory_id: string | null
        }
        Insert: {
          amount_cents: number
          category_id: string
          created_at?: string
          family_id: string
          id?: string
          month: string
          subcategory_id?: string | null
        }
        Update: {
          amount_cents?: number
          category_id?: string
          created_at?: string
          family_id?: string
          id?: string
          month?: string
          subcategory_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "transaction_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      categorization_rules: {
        Row: {
          category_id: string
          created_at: string
          family_id: string | null
          id: string
          max_amount_cents: number | null
          pattern: string
          subcategory_id: string | null
          user_id: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          family_id?: string | null
          id?: string
          max_amount_cents?: number | null
          pattern: string
          subcategory_id?: string | null
          user_id?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          family_id?: string | null
          id?: string
          max_amount_cents?: number | null
          pattern?: string
          subcategory_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorization_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorization_rules_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorization_rules_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "transaction_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_messages: {
        Row: {
          card_type: string | null
          content: string
          created_at: string
          family_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          card_type?: string | null
          content: string
          created_at?: string
          family_id: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          card_type?: string | null
          content?: string
          created_at?: string
          family_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_messages_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      default_budgets: {
        Row: {
          amount_cents: number
          category_id: string
          created_at: string
          family_id: string
          id: string
          subcategory_id: string | null
        }
        Insert: {
          amount_cents: number
          category_id: string
          created_at?: string
          family_id: string
          id?: string
          subcategory_id?: string | null
        }
        Update: {
          amount_cents?: number
          category_id?: string
          created_at?: string
          family_id?: string
          id?: string
          subcategory_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "default_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "default_budgets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "default_budgets_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "transaction_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          avatar_url: string | null
          budget_model: string | null
          created_at: string
          created_by: string | null
          id: string
          monthly_net_income_cents: number | null
          name: string
        }
        Insert: {
          avatar_url?: string | null
          budget_model?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          monthly_net_income_cents?: number | null
          name: string
        }
        Update: {
          avatar_url?: string | null
          budget_model?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          monthly_net_income_cents?: number | null
          name?: string
        }
        Relationships: []
      }
      family_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          code: string
          created_at: string
          created_by: string
          expires_at: string
          family_id: string
          id: string
          max_uses: number
          role: string
          status: string
          uses_count: number
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          code: string
          created_at?: string
          created_by: string
          expires_at?: string
          family_id: string
          id?: string
          max_uses?: number
          role?: string
          status?: string
          uses_count?: number
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          family_id?: string
          id?: string
          max_uses?: number
          role?: string
          status?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          created_at: string
          family_id: string
          id: string
          is_admin: boolean
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          is_admin?: boolean
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          is_admin?: boolean
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
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
            foreignKeyName: "goals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
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
          asset_type?: Database["public"]["Enums"]["asset_type"]
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
          asset_type?: Database["public"]["Enums"]["asset_type"]
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
            foreignKeyName: "investments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      push_preferences: {
        Row: {
          notify_family_transactions: boolean
          notify_insights: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          notify_family_transactions?: boolean
          notify_insights?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          notify_family_transactions?: boolean
          notify_insights?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_queue: {
        Row: {
          amount_cents: number | null
          attempts: number
          author_member_name: string | null
          author_user_id: string
          created_at: string
          description: string | null
          family_id: string
          id: string
          processed_at: string | null
          status: string
          transaction_id: string | null
          tx_type: string | null
        }
        Insert: {
          amount_cents?: number | null
          attempts?: number
          author_member_name?: string | null
          author_user_id: string
          created_at?: string
          description?: string | null
          family_id: string
          id?: string
          processed_at?: string | null
          status?: string
          transaction_id?: string | null
          tx_type?: string | null
        }
        Update: {
          amount_cents?: number | null
          attempts?: number
          author_member_name?: string | null
          author_user_id?: string
          created_at?: string
          description?: string | null
          family_id?: string
          id?: string
          processed_at?: string | null
          status?: string
          transaction_id?: string | null
          tx_type?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recurring_income_overrides: {
        Row: {
          amount_cents: number
          created_at: string
          family_id: string
          id: string
          month: string
          recurring_income_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          family_id: string
          id?: string
          month: string
          recurring_income_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          family_id?: string
          id?: string
          month?: string
          recurring_income_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_income_overrides_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_income_overrides_recurring_income_id_fkey"
            columns: ["recurring_income_id"]
            isOneToOne: false
            referencedRelation: "recurring_incomes"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_incomes: {
        Row: {
          active: boolean
          amount_cents: number
          category_id: string | null
          created_at: string
          day_of_month: number
          family_id: string
          id: string
          member_id: string
          name: string
          subcategory_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          active?: boolean
          amount_cents: number
          category_id?: string | null
          created_at?: string
          day_of_month: number
          family_id: string
          id?: string
          member_id: string
          name: string
          subcategory_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          active?: boolean
          amount_cents?: number
          category_id?: string | null
          created_at?: string
          day_of_month?: number
          family_id?: string
          id?: string
          member_id?: string
          name?: string
          subcategory_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "recurring_incomes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_incomes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_incomes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_incomes_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "transaction_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          external_reference: string | null
          family_id: string | null
          id: string
          plan: string
          preapproval_id: string | null
          provider: string
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          external_reference?: string | null
          family_id?: string | null
          id?: string
          plan?: string
          preapproval_id?: string | null
          provider?: string
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          external_reference?: string | null
          family_id?: string | null
          id?: string
          plan?: string
          preapproval_id?: string | null
          provider?: string
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_categories: {
        Row: {
          budget_bucket: string | null
          color: string | null
          created_at: string
          family_id: string | null
          icon: string | null
          id: string
          intent_tag: string | null
          is_hidden: boolean
          name: string
          percent_alert: number | null
          percent_default: number | null
          sort_order: number | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          budget_bucket?: string | null
          color?: string | null
          created_at?: string
          family_id?: string | null
          icon?: string | null
          id?: string
          intent_tag?: string | null
          is_hidden?: boolean
          name: string
          percent_alert?: number | null
          percent_default?: number | null
          sort_order?: number | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          budget_bucket?: string | null
          color?: string | null
          created_at?: string
          family_id?: string | null
          icon?: string | null
          id?: string
          intent_tag?: string | null
          is_hidden?: boolean
          name?: string
          percent_alert?: number | null
          percent_default?: number | null
          sort_order?: number | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_splits: {
        Row: {
          created_at: string
          created_by: string | null
          family_id: string
          id: string
          member_id: string
          share_cents: number
          transaction_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          family_id: string
          id?: string
          member_id: string
          share_cents: number
          transaction_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          family_id?: string
          id?: string
          member_id?: string
          share_cents?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_splits_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_splits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_subcategories: {
        Row: {
          category_id: string
          color: string | null
          created_at: string
          family_id: string | null
          icon: string | null
          id: string
          intent_tag: string | null
          is_hidden: boolean
          name: string
          sort_order: number
        }
        Insert: {
          category_id: string
          color?: string | null
          created_at?: string
          family_id?: string | null
          icon?: string | null
          id?: string
          intent_tag?: string | null
          is_hidden?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          color?: string | null
          created_at?: string
          family_id?: string | null
          icon?: string | null
          id?: string
          intent_tag?: string | null
          is_hidden?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_subcategories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          ai_confidence: number | null
          ai_reasoning: string | null
          amount_cents: number
          bank_transaction_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          family_id: string
          id: string
          installment_group_id: string | null
          installment_number: number | null
          installment_total: number | null
          is_installment: boolean
          is_recurring: boolean
          member_id: string
          payment_method: string | null
          recurring_income_id: string | null
          recurring_month: string | null
          status: string
          subcategory_id: string | null
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          ai_confidence?: number | null
          ai_reasoning?: string | null
          amount_cents: number
          bank_transaction_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          family_id: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_installment?: boolean
          is_recurring?: boolean
          member_id: string
          payment_method?: string | null
          recurring_income_id?: string | null
          recurring_month?: string | null
          status?: string
          subcategory_id?: string | null
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          ai_confidence?: number | null
          ai_reasoning?: string | null
          amount_cents?: number
          bank_transaction_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          family_id?: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_installment?: boolean
          is_recurring?: boolean
          member_id?: string
          payment_method?: string | null
          recurring_income_id?: string | null
          recurring_month?: string | null
          status?: string
          subcategory_id?: string | null
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_income_id_fkey"
            columns: ["recurring_income_id"]
            isOneToOne: false
            referencedRelation: "recurring_incomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "transaction_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          ai_consent: boolean
          ai_consent_at: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_consent?: boolean
          ai_consent_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_consent?: boolean
          ai_consent_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      whatsapp_debug: {
        Row: {
          created_at: string
          detail: Json | null
          id: number
          step: string
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          id?: number
          step: string
        }
        Update: {
          created_at?: string
          detail?: Json | null
          id?: number
          step?: string
        }
        Relationships: []
      }
      whatsapp_processed_messages: {
        Row: {
          message_id: string
          processed_at: string
          wa_user: string
        }
        Insert: {
          message_id: string
          processed_at?: string
          wa_user: string
        }
        Update: {
          message_id?: string
          processed_at?: string
          wa_user?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_family_invite: { Args: { p_code: string }; Returns: Json }
      activate_family_onboarding_plan: {
        Args: {
          p_family_id: string
          p_model_preset_id?: string
          p_monthly_net_income_cents: number
        }
        Returns: Json
      }
      add_family_member_without_account: {
        Args: { p_family_id: string; p_name: string }
        Returns: Json
      }
      cancel_my_subscription: {
        Args: never
        Returns: {
          out_canceled_at: string
          out_current_period_end: string
        }[]
      }
      check_ai_rate_limit: {
        Args: {
          p_function_name: string
          p_max_requests: number
          p_window_minutes: number
        }
        Returns: Json
      }
      cleanup_abandoned_families: { Args: { p_user_id: string }; Returns: Json }
      create_new_family_workspace: {
        Args: { p_family_name: string; p_member_name: string }
        Returns: string
      }
      create_transaction_with_splits: {
        Args: {
          p_amount_cents: number
          p_category_id: string
          p_description: string
          p_family_id: string
          p_member_id: string
          p_payment_method?: string
          p_splits: Json
          p_subcategory_id?: string
          p_transaction_date: string
          p_type: string
        }
        Returns: string
      }
      create_whatsapp_transaction: {
        Args: {
          p_amount_cents: number
          p_category_id: string
          p_description: string
          p_family_id: string
          p_member_id: string
          p_payment_method?: string
          p_transaction_date: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      delete_family_workspace: { Args: { p_family_id: string }; Returns: Json }
      delete_user_account: { Args: never; Returns: Json }
      fmt_brl_cents: { Args: { p_cents: number }; Returns: string }
      generate_family_invite: { Args: { p_family_id: string }; Returns: Json }
      get_family_balance_series: {
        Args: { p_days?: number; p_family_id: string }
        Returns: {
          balance_cents: number
          day: string
        }[]
      }
      get_family_balance_until: {
        Args: { p_family_id: string; p_until_date: string }
        Returns: {
          total_expense_cents: number
          total_income_cents: number
        }[]
      }
      get_family_insights: {
        Args: { p_family_id: string; p_month?: string }
        Returns: Json
      }
      get_family_push_targets: {
        Args: { p_author_user_id: string; p_family_id: string }
        Returns: {
          auth: string
          endpoint: string
          p256dh: string
          user_id: string
        }[]
      }
      get_family_settlement: {
        Args: { p_family_id: string; p_month: string }
        Returns: Json
      }
      get_family_totals: { Args: { p_family_id: string }; Returns: Json }
      get_invite_preview: { Args: { p_code: string }; Returns: Json }
      get_my_access_status: { Args: never; Returns: Json }
      get_my_subscription: { Args: never; Returns: Json }
      leave_family: { Args: { p_family_id: string }; Returns: Json }
      remove_family_member: { Args: { p_member_id: string }; Returns: Json }
      rename_family_member: {
        Args: { p_member_id: string; p_new_name: string }
        Returns: Json
      }
      reorder_family_categories: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      reorder_family_subcategories: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      upsert_subscription_from_webhook:
        | {
            Args: {
              p_email: string
              p_external_reference?: string
              p_payer_id?: string
              p_plan: string
              p_preapproval_id: string
              p_status: string
            }
            Returns: string
          }
        | {
            Args: {
              p_email: string
              p_external_reference?: string
              p_payer_id?: string
              p_plan: string
              p_preapproval_id: string
              p_provider?: string
              p_status: string
            }
            Returns: string
          }
      user_belongs_to_family: { Args: { f_id: string }; Returns: boolean }
    }
    Enums: {
      asset_type:
        | "stock"
        | "fii"
        | "fixed_income"
        | "crypto"
        | "treasury"
        | "other"
      transaction_type: "income" | "expense"
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
      asset_type: [
        "stock",
        "fii",
        "fixed_income",
        "crypto",
        "treasury",
        "other",
      ],
      transaction_type: ["income", "expense"],
    },
  },
} as const

