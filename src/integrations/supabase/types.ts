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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bug_apps: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          versions: string[]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          versions?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          versions?: string[]
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          app: string
          app_version: string
          created_at: string
          description: string
          id: string
          reward_amount: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app: string
          app_version?: string
          created_at?: string
          description?: string
          id?: string
          reward_amount?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app?: string
          app_version?: string
          created_at?: string
          description?: string
          id?: string
          reward_amount?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      class_students: {
        Row: {
          class_id: string
          created_at: string
          id: string
          student_user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          student_user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          student_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: string
          created_at: string
          id: string
          subject: string
          teacher_user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          subject: string
          teacher_user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          subject?: string
          teacher_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      croin_code_redemptions: {
        Row: {
          amount: number
          code_id: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          amount: number
          code_id: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          code_id?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "croin_code_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "croin_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      croin_codes: {
        Row: {
          active: boolean
          amount: number
          code: string
          created_at: string
          created_by: string
          id: string
          max_uses: number
          updated_at: string
          uses: number
        }
        Insert: {
          active?: boolean
          amount: number
          code: string
          created_at?: string
          created_by: string
          id?: string
          max_uses: number
          updated_at?: string
          uses?: number
        }
        Update: {
          active?: boolean
          amount?: number
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          max_uses?: number
          updated_at?: string
          uses?: number
        }
        Relationships: []
      }
      croin_price_history: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          price: number
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          price?: number
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          price?: number
        }
        Relationships: []
      }
      croin_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      info_page: {
        Row: {
          content: string
          created_at: string
          id: string
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      news_posts: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      newspaper_issues: {
        Row: {
          content: string
          cover_url: string | null
          created_at: string
          created_by: string
          id: string
          published: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          cover_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          published?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          published?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      owner_links: {
        Row: {
          created_at: string
          created_by: string
          icon: string
          id: string
          kind: string
          sort_order: number
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          icon?: string
          id?: string
          kind?: string
          sort_order?: number
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          icon?: string
          id?: string
          kind?: string
          sort_order?: number
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          cross_chat_id: string | null
          crossi_ai_id: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cross_chat_id?: string | null
          crossi_ai_id?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cross_chat_id?: string | null
          crossi_ai_id?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_user_id: string
          referrer_id: string
          reward_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_id: string
          reward_amount?: number
        }
        Update: {
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_id?: string
          reward_amount?: number
        }
        Relationships: []
      }
      school_classes: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_members: {
        Row: {
          created_at: string
          display_name: string
          id: string
          role: string
          school_id: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          role: string
          school_id: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          role?: string
          school_id?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          name: string
          pool_balance: number
          principal_user_id: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          name: string
          pool_balance?: number
          principal_user_id: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          name?: string
          pool_balance?: number
          principal_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_restrictions: {
        Row: {
          class_id: string
          id: string
          restrict_croins: boolean
          restrict_news: boolean
          restrict_newspaper: boolean
          restrict_other: boolean
          student_user_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          id?: string
          restrict_croins?: boolean
          restrict_news?: boolean
          restrict_newspaper?: boolean
          restrict_other?: boolean
          student_user_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          id?: string
          restrict_croins?: boolean
          restrict_news?: boolean
          restrict_newspaper?: boolean
          restrict_other?: boolean
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_restrictions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_2fa: {
        Row: {
          created_at: string
          enabled: boolean
          face_descriptor: Json | null
          id: string
          method: string | null
          phone: string | null
          secret_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          face_descriptor?: Json | null
          id?: string
          method?: string | null
          phone?: string | null
          secret_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          face_descriptor?: Json | null
          id?: string
          method?: string | null
          phone?: string | null
          secret_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_2fa_challenges: {
        Row: {
          code_hash: string | null
          consumed: boolean
          created_at: string
          expires_at: string
          id: string
          method: string
          purpose: string
          user_id: string
        }
        Insert: {
          code_hash?: string | null
          consumed?: boolean
          created_at?: string
          expires_at: string
          id?: string
          method: string
          purpose?: string
          user_id: string
        }
        Update: {
          code_hash?: string | null
          consumed?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          method?: string
          purpose?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_school_role: { Args: { _uid: string }; Returns: string }
      get_user_school_id: { Args: { _uid: string }; Returns: string }
      is_in_class: { Args: { _class: string; _uid: string }; Returns: boolean }
      is_owner_email: { Args: never; Returns: boolean }
      is_principal_of: {
        Args: { _school: string; _uid: string }
        Returns: boolean
      }
      is_teacher_of_class: {
        Args: { _class: string; _uid: string }
        Returns: boolean
      }
      simulate_croin_price: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
