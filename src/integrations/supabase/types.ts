export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      attendance: {
        Row: {
          approved: boolean | null;
          attendance_type: string | null;
          clock_in: string | null;
          clock_out: string | null;
          created_at: string | null;
          duration_minutes: number | null;
          geo_lat: number | null;
          geo_lng: number | null;
          id: string;
          task_id: string | null;
          user_id: string;
        };
        Insert: {
          approved?: boolean | null;
          attendance_type?: string | null;
          clock_in?: string | null;
          clock_out?: string | null;
          created_at?: string | null;
          duration_minutes?: number | null;
          geo_lat?: number | null;
          geo_lng?: number | null;
          id?: string;
          task_id?: string | null;
          user_id: string;
        };
        Update: {
          approved?: boolean | null;
          attendance_type?: string | null;
          clock_in?: string | null;
          clock_out?: string | null;
          created_at?: string | null;
          duration_minutes?: number | null;
          geo_lat?: number | null;
          geo_lng?: number | null;
          id?: string;
          task_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      billing_records: {
        Row: {
          amount: number;
          created_at: string | null;
          hours: number;
          id: string;
          project_id: string | null;
          rate: number;
          task_id: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          hours: number;
          id?: string;
          project_id?: string | null;
          rate: number;
          task_id?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          hours?: number;
          id?: string;
          project_id?: string | null;
          rate?: number;
          task_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_records_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_records_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_records_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string | null;
          id: string;
          payload: Json | null;
          read: boolean | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string | null;
          id?: string;
          payload?: Json | null;
          read?: boolean | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string | null;
          id?: string;
          payload?: Json | null;
          read?: boolean | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          created_at: string | null;
          full_name: string | null;
          hourly_rate: number | null;
          id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          created_at?: string | null;
          full_name?: string | null;
          hourly_rate?: number | null;
          id: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          created_at?: string | null;
          full_name?: string | null;
          hourly_rate?: number | null;
          id?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          created_at: string | null;
          id: string;
          project_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          project_id: string;
          role: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          project_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      projects: {
        Row: {
          budget: number | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          end_date: string | null;
          id: string;
          name: string;
          start_date: string | null;
          status: string | null;
        };
        Insert: {
          budget?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          name: string;
          start_date?: string | null;
          status?: string | null;
        };
        Update: {
          budget?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          name?: string;
          start_date?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      task_assignments: {
        Row: {
          assigned_at: string | null;
          id: string;
          task_id: string;
          user_id: string;
        };
        Insert: {
          assigned_at?: string | null;
          id?: string;
          task_id: string;
          user_id: string;
        };
        Update: {
          assigned_at?: string | null;
          id?: string;
          task_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_assignments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      task_dependencies: {
        Row: {
          created_at: string | null;
          depends_on_task_id: string;
          id: string;
          task_id: string;
        };
        Insert: {
          created_at?: string | null;
          depends_on_task_id: string;
          id?: string;
          task_id: string;
        };
        Update: {
          created_at?: string | null;
          depends_on_task_id?: string;
          id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey";
            columns: ["depends_on_task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          }
        ];
      };
      tasks: {
        Row: {
          billable: boolean | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          end_datetime: string | null;
          estimated_hours: number | null;
          geo_lat: number | null;
          geo_lng: number | null;
          geo_radius_m: number | null;
          id: string;
          project_id: string;
          recurrence: Json | null;
          start_datetime: string | null;
          status: Database["public"]["Enums"]["task_status"] | null;
          title: string;
          type: Database["public"]["Enums"]["task_type"] | null;
        };
        Insert: {
          billable?: boolean | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          end_datetime?: string | null;
          estimated_hours?: number | null;
          geo_lat?: number | null;
          geo_lng?: number | null;
          geo_radius_m?: number | null;
          id?: string;
          project_id: string;
          recurrence?: Json | null;
          start_datetime?: string | null;
          status?: Database["public"]["Enums"]["task_status"] | null;
          title: string;
          type?: Database["public"]["Enums"]["task_type"] | null;
        };
        Update: {
          billable?: boolean | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          end_datetime?: string | null;
          estimated_hours?: number | null;
          geo_lat?: number | null;
          geo_lng?: number | null;
          geo_radius_m?: number | null;
          id?: string;
          project_id?: string;
          recurrence?: Json | null;
          start_datetime?: string | null;
          status?: Database["public"]["Enums"]["task_status"] | null;
          title?: string;
          type?: Database["public"]["Enums"]["task_type"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      app_role: "admin" | "supervisor" | "worker";
      task_status: "todo" | "in_progress" | "blocked" | "done" | "cancelled";
      task_type: "attendance" | "general";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "supervisor", "worker"],
      task_status: ["todo", "in_progress", "blocked", "done", "cancelled"],
      task_type: ["attendance", "general"],
    },
  },
} as const;
