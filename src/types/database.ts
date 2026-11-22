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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      diary_attachments: {
        Row: {
          created_at: string
          entry_id: string
          file_id: string
          id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          file_id: string
          id?: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          file_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_attachments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_attachments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: true
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_entries: {
        Row: {
          body: string
          cancelled_at: string | null
          cancelled_by: string | null
          edited_at: string | null
          edited_by_name: string | null
          entered_at: string
          id: string
          project_id: string
          reporter_id: string
          reporter_name: string
          request_id: string
          revision: number
          work_date: string
        }
        Insert: {
          body: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          edited_at?: string | null
          edited_by_name?: string | null
          entered_at?: string
          id?: string
          project_id: string
          reporter_id: string
          reporter_name: string
          request_id: string
          revision?: number
          work_date: string
        }
        Update: {
          body?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          edited_at?: string | null
          edited_by_name?: string | null
          entered_at?: string
          id?: string
          project_id?: string
          reporter_id?: string
          reporter_name?: string
          request_id?: string
          revision?: number
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_entries_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_version_files: {
        Row: {
          attachment_id: string
          entry_id: string
          position: number
          version: number
        }
        Insert: {
          attachment_id: string
          entry_id: string
          position: number
          version: number
        }
        Update: {
          attachment_id?: string
          entry_id?: string
          position?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "diary_version_files_attachment_id_entry_id_fkey"
            columns: ["attachment_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "diary_attachments"
            referencedColumns: ["id", "entry_id"]
          },
          {
            foreignKeyName: "diary_version_files_entry_id_version_fkey"
            columns: ["entry_id", "version"]
            isOneToOne: false
            referencedRelation: "diary_versions"
            referencedColumns: ["entry_id", "version"]
          },
        ]
      }
      diary_versions: {
        Row: {
          body: string
          cancelled: boolean
          created_at: string
          editor_id: string
          editor_name: string
          entry_id: string
          kind: Database["public"]["Enums"]["version_kind"]
          project_id: string
          reporter_name: string
          version: number
          work_date: string
        }
        Insert: {
          body: string
          cancelled: boolean
          created_at?: string
          editor_id: string
          editor_name: string
          entry_id: string
          kind: Database["public"]["Enums"]["version_kind"]
          project_id: string
          reporter_name: string
          version: number
          work_date: string
        }
        Update: {
          body?: string
          cancelled?: boolean
          created_at?: string
          editor_id?: string
          editor_name?: string
          entry_id?: string
          kind?: Database["public"]["Enums"]["version_kind"]
          project_id?: string
          reporter_name?: string
          version?: number
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_versions_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_versions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_grants: {
        Row: {
          created_at: string
          document_id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_grants_document_id_project_id_fkey"
            columns: ["document_id", "project_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "document_grants_project_id_user_id_fkey"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["project_id", "user_id"]
          },
        ]
      }
      documents: {
        Row: {
          access: Database["public"]["Enums"]["document_access"]
          archived_at: string | null
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          file_id: string
          id: string
          project_id: string
          replaces_document_id: string | null
          revision: number
          uploaded_by: string
          uploaded_by_name: string
        }
        Insert: {
          access: Database["public"]["Enums"]["document_access"]
          archived_at?: string | null
          category: Database["public"]["Enums"]["document_category"]
          created_at?: string
          file_id: string
          id?: string
          project_id: string
          replaces_document_id?: string | null
          revision?: number
          uploaded_by: string
          uploaded_by_name: string
        }
        Update: {
          access?: Database["public"]["Enums"]["document_access"]
          archived_at?: string | null
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          file_id?: string
          id?: string
          project_id?: string
          replaces_document_id?: string | null
          revision?: number
          uploaded_by?: string
          uploaded_by_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: true
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_replaces_document_id_project_id_fkey"
            columns: ["replaces_document_id", "project_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          finance_access: boolean
          project_id: string
          revision: number
          role: Database["public"]["Enums"]["project_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          finance_access?: boolean
          project_id: string
          revision?: number
          role: Database["public"]["Enums"]["project_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          finance_access?: boolean
          project_id?: string
          revision?: number
          role?: Database["public"]["Enums"]["project_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          is_owner: boolean
          revision: number
          sessions_valid_after: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          is_owner?: boolean
          revision?: number
          sessions_valid_after?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_owner?: boolean
          revision?: number
          sessions_valid_after?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_contacts: {
        Row: {
          email: string | null
          name: string
          phone: string
          project_id: string
          role_title: string | null
        }
        Insert: {
          email?: string | null
          name: string
          phone: string
          project_id: string
          role_title?: string | null
        }
        Update: {
          email?: string | null
          name?: string
          phone?: string
          project_id?: string
          role_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_covers: {
        Row: {
          created_at: string
          created_by: string
          file_id: string
          id: string
          is_active: boolean
          project_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          file_id: string
          id?: string
          is_active?: boolean
          project_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          file_id?: string
          id?: string
          is_active?: boolean
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_covers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_covers_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: true
            referencedRelation: "stored_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_covers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_finance_settings: {
        Row: {
          excel_url: string | null
          project_id: string
          revision: number
        }
        Insert: {
          excel_url?: string | null
          project_id: string
          revision?: number
        }
        Update: {
          excel_url?: string | null
          project_id?: string
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_finance_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_private: {
        Row: {
          business_number: string | null
          project_id: string
        }
        Insert: {
          business_number?: string | null
          project_id: string
        }
        Update: {
          business_number?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_private_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          access_notes: string | null
          archived_at: string | null
          business_name: string
          created_at: string
          created_by: string
          end_date: string | null
          id: string
          name: string
          request_id: string
          revision: number
          site_address: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          access_notes?: string | null
          archived_at?: string | null
          business_name: string
          created_at?: string
          created_by: string
          end_date?: string | null
          id?: string
          name: string
          request_id: string
          revision?: number
          site_address: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          access_notes?: string | null
          archived_at?: string | null
          business_name?: string
          created_at?: string
          created_by?: string
          end_date?: string | null
          id?: string
          name?: string
          request_id?: string
          revision?: number
          site_address?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sensitive_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string
          after: Json | null
          before: Json | null
          entity_id: string
          entity_type: string
          id: number
          occurred_at: string
          project_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label: string
          after?: Json | null
          before?: Json | null
          entity_id: string
          entity_type: string
          id?: never
          occurred_at?: string
          project_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string
          after?: Json | null
          before?: Json | null
          entity_id?: string
          entity_type?: string
          id?: never
          occurred_at?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sensitive_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensitive_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stored_files: {
        Row: {
          bucket: string
          created_at: string
          declared_mime: string
          declared_size: number
          display_path: string | null
          display_state: Database["public"]["Enums"]["display_state"]
          id: string
          mime: string | null
          object_path: string
          original_name: string
          project_id: string
          purpose: Database["public"]["Enums"]["file_purpose"]
          ready_at: string | null
          sha256: string | null
          size_bytes: number | null
          state: Database["public"]["Enums"]["file_state"]
          uploaded_by: string
        }
        Insert: {
          bucket: string
          created_at?: string
          declared_mime: string
          declared_size: number
          display_path?: string | null
          display_state?: Database["public"]["Enums"]["display_state"]
          id?: string
          mime?: string | null
          object_path: string
          original_name: string
          project_id: string
          purpose: Database["public"]["Enums"]["file_purpose"]
          ready_at?: string | null
          sha256?: string | null
          size_bytes?: number | null
          state?: Database["public"]["Enums"]["file_state"]
          uploaded_by: string
        }
        Update: {
          bucket?: string
          created_at?: string
          declared_mime?: string
          declared_size?: number
          display_path?: string | null
          display_state?: Database["public"]["Enums"]["display_state"]
          id?: string
          mime?: string | null
          object_path?: string
          original_name?: string
          project_id?: string
          purpose?: Database["public"]["Enums"]["file_purpose"]
          ready_at?: string | null
          sha256?: string | null
          size_bytes?: number | null
          state?: Database["public"]["Enums"]["file_state"]
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "stored_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stored_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          body: string
          completed: boolean
          created_at: string
          created_by: string
          deleted_at: string | null
          due_date: string | null
          id: string
          project_id: string
          request_id: string
          revision: number
          updated_at: string
        }
        Insert: {
          body: string
          completed?: boolean
          created_at?: string
          created_by: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          request_id: string
          revision?: number
          updated_at?: string
        }
        Update: {
          body?: string
          completed?: boolean
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          request_id?: string
          revision?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          day: number | null
          details: string
          id: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          month: number
          position: number
          project_id: string
          request_id: string
          revision: number
          updated_at: string
          updated_by: string
          year: number
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by: string
          day?: number | null
          details: string
          id?: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          month: number
          position?: never
          project_id: string
          request_id: string
          revision?: number
          updated_at?: string
          updated_by: string
          year: number
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          day?: number | null
          details?: string
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
          month?: number
          position?: never
          project_id?: string
          request_id?: string
          revision?: number
          updated_at?: string
          updated_by?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authorize_file: { Args: { input: Json }; Returns: Json }
      begin_upload: { Args: { input: Json }; Returns: Json }
      cancel_entry: { Args: { input: Json }; Returns: Json }
      cancel_transaction: { Args: { input: Json }; Returns: Json }
      correct_entry: { Args: { input: Json }; Returns: Json }
      create_document: { Args: { input: Json }; Returns: Json }
      create_entry: { Args: { input: Json }; Returns: Json }
      create_profile: { Args: { input: Json }; Returns: Json }
      create_project: { Args: { input: Json }; Returns: Json }
      create_task: { Args: { input: Json }; Returns: Json }
      create_transaction: { Args: { input: Json }; Returns: Json }
      delete_task: { Args: { input: Json }; Returns: Json }
      diary_summary: { Args: { input: Json }; Returns: Json }
      finance_all_month_totals: { Args: { input: Json }; Returns: Json }
      finance_month_totals: { Args: { input: Json }; Returns: Json }
      get_actor: { Args: { input: Json }; Returns: Json }
      get_pending_upload: { Args: { input: Json }; Returns: Json }
      move_entry: { Args: { input: Json }; Returns: Json }
      project_access_candidates: { Args: { input: Json }; Returns: Json }
      project_cards: { Args: { input: Json }; Returns: Json }
      project_manager_names: { Args: { input: Json }; Returns: Json }
      project_permissions: { Args: { input: Json }; Returns: Json }
      remove_membership: { Args: { input: Json }; Returns: Json }
      revoke_user_sessions: { Args: { input: Json }; Returns: Json }
      set_document_access: { Args: { input: Json }; Returns: Json }
      set_document_archived: { Args: { input: Json }; Returns: Json }
      set_finance_access: { Args: { input: Json }; Returns: Json }
      set_finance_link: { Args: { input: Json }; Returns: Json }
      set_membership: { Args: { input: Json }; Returns: Json }
      set_project_archived: { Args: { input: Json }; Returns: Json }
      set_project_cover: { Args: { input: Json }; Returns: Json }
      set_project_status: { Args: { input: Json }; Returns: Json }
      set_task_completed: { Args: { input: Json }; Returns: Json }
      set_user_active: { Args: { input: Json }; Returns: Json }
      system_bootstrap_owner: { Args: { input: Json }; Returns: Json }
      system_finish_upload: { Args: { input: Json }; Returns: Json }
      system_owner_recovered: { Args: { input: Json }; Returns: Json }
      update_profile: { Args: { input: Json }; Returns: Json }
      update_project: { Args: { input: Json }; Returns: Json }
      update_task: { Args: { input: Json }; Returns: Json }
      update_transaction: { Args: { input: Json }; Returns: Json }
    }
    Enums: {
      display_state: "none" | "ready" | "failed"
      document_access: "owner" | "all" | "selected"
      document_category:
        | "specification"
        | "plans"
        | "additional_plans"
        | "renderings"
      file_purpose: "document" | "diary" | "cover"
      file_state: "pending" | "ready" | "rejected"
      project_role: "manager" | "worker"
      project_status: "active" | "completed"
      transaction_kind:
        | "income"
        | "income_refund"
        | "expense"
        | "expense_credit"
      version_kind: "created" | "corrected" | "moved" | "cancelled"
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
      display_state: ["none", "ready", "failed"],
      document_access: ["owner", "all", "selected"],
      document_category: [
        "specification",
        "plans",
        "additional_plans",
        "renderings",
      ],
      file_purpose: ["document", "diary", "cover"],
      file_state: ["pending", "ready", "rejected"],
      project_role: ["manager", "worker"],
      project_status: ["active", "completed"],
      transaction_kind: [
        "income",
        "income_refund",
        "expense",
        "expense_credit",
      ],
      version_kind: ["created", "corrected", "moved", "cancelled"],
    },
  },
} as const
