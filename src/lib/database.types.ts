export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      bets: {
        Row: {
          created_at: string;
          id: string;
          market_id: string;
          payout: number | null;
          pool_id: string;
          price_at_bet: number;
          settled_at: string | null;
          side: Database["public"]["Enums"]["bet_side"];
          stake: number;
          status: Database["public"]["Enums"]["bet_status"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          market_id: string;
          payout?: number | null;
          pool_id: string;
          price_at_bet: number;
          settled_at?: string | null;
          side: Database["public"]["Enums"]["bet_side"];
          stake: number;
          status?: Database["public"]["Enums"]["bet_status"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          market_id?: string;
          payout?: number | null;
          pool_id?: string;
          price_at_bet?: number;
          settled_at?: string | null;
          side?: Database["public"]["Enums"]["bet_side"];
          stake?: number;
          status?: Database["public"]["Enums"]["bet_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bets_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bets_pool_id_fkey";
            columns: ["pool_id"];
            isOneToOne: false;
            referencedRelation: "pools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comment_likes: {
        Row: {
          comment_id: string;
          created_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          comment_id: string;
          created_at?: string;
          user_id?: string;
        };
        Update: {
          comment_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          body: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          like_count: number;
          market_id: string;
          meta: NonNullable<Json>;
          parent_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          like_count?: number;
          market_id: string;
          meta?: NonNullable<Json>;
          parent_id?: string | null;
          user_id?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          like_count?: number;
          market_id?: string;
          meta?: NonNullable<Json>;
          parent_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      communities: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string;
          email_domain: string | null;
          id: string;
          kind: Database["public"]["Enums"]["community_kind"];
          member_count: number;
          meta: NonNullable<Json>;
          name: string;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string;
          email_domain?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["community_kind"];
          member_count?: number;
          meta?: NonNullable<Json>;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string;
          email_domain?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["community_kind"];
          member_count?: number;
          meta?: NonNullable<Json>;
          name?: string;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "communities_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_members: {
        Row: {
          community_id: string;
          created_at: string;
          joined_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          community_id: string;
          created_at?: string;
          joined_at?: string;
          user_id?: string;
        };
        Update: {
          community_id?: string;
          created_at?: string;
          joined_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      follows: {
        Row: {
          created_at: string;
          followee_id: string;
          follower_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          followee_id: string;
          follower_id?: string;
        };
        Update: {
          created_at?: string;
          followee_id?: string;
          follower_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey";
            columns: ["followee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["ledger_kind"];
          ref_id: string | null;
          ref_type: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["ledger_kind"];
          ref_id?: string | null;
          ref_type?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["ledger_kind"];
          ref_id?: string | null;
          ref_type?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      market_likes: {
        Row: {
          created_at: string;
          market_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          market_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          market_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_likes_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      market_settlements: {
        Row: {
          created_at: string;
          distributable: number;
          dust: number | null;
          house_take: number;
          id: string;
          kind: Database["public"]["Enums"]["settlement_kind"];
          market_id: string;
          outcome: Database["public"]["Enums"]["bet_side"] | null;
          paid_out: number;
          pool_id: string;
          settled_at: string;
          total: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          distributable: number;
          dust?: never;
          house_take: number;
          id?: string;
          kind: Database["public"]["Enums"]["settlement_kind"];
          market_id: string;
          outcome?: Database["public"]["Enums"]["bet_side"] | null;
          paid_out: number;
          pool_id: string;
          settled_at?: string;
          total: number;
        };
        Update: {
          created_at?: string;
          distributable?: number;
          dust?: never;
          house_take?: number;
          id?: string;
          kind?: Database["public"]["Enums"]["settlement_kind"];
          market_id?: string;
          outcome?: Database["public"]["Enums"]["bet_side"] | null;
          paid_out?: number;
          pool_id?: string;
          settled_at?: string;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "market_settlements_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_settlements_pool_id_fkey";
            columns: ["pool_id"];
            isOneToOne: true;
            referencedRelation: "pools";
            referencedColumns: ["id"];
          },
        ];
      };
      markets: {
        Row: {
          bet_count: number;
          category: Database["public"]["Enums"]["market_category"];
          closes_at: string;
          comment_count: number;
          community_id: string | null;
          created_at: string;
          creator_id: string;
          details: string;
          featured_at: string | null;
          id: string;
          like_count: number;
          max_stake: number;
          meta: NonNullable<Json>;
          no_total: number;
          outcome: Database["public"]["Enums"]["bet_side"] | null;
          pool_capacity: number | null;
          question: string;
          rake_bps: number;
          resolution_note: string | null;
          resolution_proof_url: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          resolves_by: string;
          status: Database["public"]["Enums"]["market_status"];
          yes_total: number;
        };
        ComputedFields: never;
        Insert: {
          bet_count?: number;
          category?: Database["public"]["Enums"]["market_category"];
          closes_at: string;
          comment_count?: number;
          community_id?: string | null;
          created_at?: string;
          creator_id?: string;
          details?: string;
          featured_at?: string | null;
          id?: string;
          like_count?: number;
          max_stake?: number;
          meta?: NonNullable<Json>;
          no_total?: number;
          outcome?: Database["public"]["Enums"]["bet_side"] | null;
          pool_capacity?: number | null;
          question: string;
          rake_bps?: number;
          resolution_note?: string | null;
          resolution_proof_url?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          resolves_by: string;
          status?: Database["public"]["Enums"]["market_status"];
          yes_total?: number;
        };
        Update: {
          bet_count?: number;
          category?: Database["public"]["Enums"]["market_category"];
          closes_at?: string;
          comment_count?: number;
          community_id?: string | null;
          created_at?: string;
          creator_id?: string;
          details?: string;
          featured_at?: string | null;
          id?: string;
          like_count?: number;
          max_stake?: number;
          meta?: NonNullable<Json>;
          no_total?: number;
          outcome?: Database["public"]["Enums"]["bet_side"] | null;
          pool_capacity?: number | null;
          question?: string;
          rake_bps?: number;
          resolution_note?: string | null;
          resolution_proof_url?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          resolves_by?: string;
          status?: Database["public"]["Enums"]["market_status"];
          yes_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "markets_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "markets_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "markets_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pools: {
        Row: {
          capacity: number | null;
          created_at: string;
          id: string;
          index: number;
          market_id: string;
          member_count: number;
          no_total: number;
          status: Database["public"]["Enums"]["pool_status"];
          yes_total: number;
        };
        ComputedFields: never;
        Insert: {
          capacity?: number | null;
          created_at?: string;
          id?: string;
          index: number;
          market_id: string;
          member_count?: number;
          no_total?: number;
          status?: Database["public"]["Enums"]["pool_status"];
          yes_total?: number;
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          id?: string;
          index?: number;
          market_id?: string;
          member_count?: number;
          no_total?: number;
          status?: Database["public"]["Enums"]["pool_status"];
          yes_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pools_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          balance: number;
          banned_at: string | null;
          bio: string | null;
          created_at: string;
          default_stake: number;
          display_name: string | null;
          id: string;
          meta: NonNullable<Json>;
          role: Database["public"]["Enums"]["user_role"];
          school_domain: string | null;
          username: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          balance?: number;
          banned_at?: string | null;
          bio?: string | null;
          created_at?: string;
          default_stake?: number;
          display_name?: string | null;
          id: string;
          meta?: NonNullable<Json>;
          role?: Database["public"]["Enums"]["user_role"];
          school_domain?: string | null;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          balance?: number;
          banned_at?: string | null;
          bio?: string | null;
          created_at?: string;
          default_stake?: number;
          display_name?: string | null;
          id?: string;
          meta?: NonNullable<Json>;
          role?: Database["public"]["Enums"]["user_role"];
          school_domain?: string | null;
          username?: string | null;
        };
        Relationships: [];
      };
      swipe_events: {
        Row: {
          action: Database["public"]["Enums"]["swipe_action"];
          created_at: string;
          dwell_ms: number | null;
          id: string;
          market_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: Database["public"]["Enums"]["swipe_action"];
          created_at?: string;
          dwell_ms?: number | null;
          id?: string;
          market_id: string;
          user_id?: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["swipe_action"];
          created_at?: string;
          dwell_ms?: number | null;
          id?: string;
          market_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "swipe_events_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "swipe_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cancel_bet: {
        Args: { p_bet_id: string };
        Returns: {
          balance: number;
          bet_id: string;
          implied_yes: number;
          market_id: string;
          no_total: number;
          yes_total: number;
        }[];
      };
      claim_daily_bonus: { Args: Record<PropertyKey, never>; Returns: number };
      close_due_markets: { Args: Record<PropertyKey, never>; Returns: number };
      delete_comment: { Args: { p_comment_id: string }; Returns: undefined };
      get_feed: {
        Args: { p_exclude?: string[]; p_limit?: number };
        Returns: {
          bet_count: number;
          bets_last_minute: number;
          category: Database["public"]["Enums"]["market_category"];
          closes_at: string;
          comment_count: number;
          community_id: string;
          community_name: string;
          community_slug: string;
          creator_id: string;
          creator_username: string;
          details: string;
          featured: boolean;
          id: string;
          like_count: number;
          liked: boolean;
          max_stake: number;
          no_total: number;
          question: string;
          rake_bps: number;
          score: number;
          yes_total: number;
        }[];
      };
      get_profile_stats: {
        Args: { p_user_id: string };
        Returns: {
          active_bets: number;
          best_streak: number;
          current_streak: number;
          followers: number;
          following: number;
          losses: number;
          net_won: number;
          win_rate: number;
          wins: number;
        }[];
      };
      implied_yes: { Args: { p_no: number; p_yes: number }; Returns: number };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_banned: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_moderator: { Args: Record<PropertyKey, never>; Returns: boolean };
      place_bet: {
        Args: {
          p_dwell_ms?: number;
          p_market_id: string;
          p_side: Database["public"]["Enums"]["bet_side"];
          p_stake: number;
        };
        Returns: {
          balance: number;
          bet_id: string;
          created_at: string;
          implied_yes: number;
          market_id: string;
          no_total: number;
          pool_id: string;
          pool_no_bettors: number;
          pool_no_total: number;
          pool_yes_bettors: number;
          pool_yes_total: number;
          price_at_bet: number;
          side: Database["public"]["Enums"]["bet_side"];
          stake: number;
          yes_total: number;
        }[];
      };
      post_ledger: {
        Args: {
          p_amount: number;
          p_kind: Database["public"]["Enums"]["ledger_kind"];
          p_ref_id?: string;
          p_ref_type?: string;
          p_user_id: string;
        };
        Returns: number;
      };
      resolve_market: {
        Args: {
          p_market_id: string;
          p_note?: string;
          p_outcome: Database["public"]["Enums"]["bet_side"];
          p_proof_url?: string;
        };
        Returns: {
          house_take: number;
          market_id: string;
          outcome: Database["public"]["Enums"]["bet_side"];
          paid_out: number;
          pools_refunded: number;
          pools_settled: number;
          total: number;
        }[];
      };
      set_market_featured: { Args: { p_featured: boolean; p_market_id: string }; Returns: string };
      set_user_banned: { Args: { p_banned: boolean; p_user_id: string }; Returns: string };
      void_market: {
        Args: { p_market_id: string; p_note?: string };
        Returns: {
          market_id: string;
          refunded: number;
        }[];
      };
    };
    Enums: {
      bet_side: "yes" | "no";
      bet_status: "active" | "cancelled" | "won" | "lost" | "refunded";
      community_kind: "school" | "topic";
      ledger_kind: "signup_bonus" | "daily_bonus" | "bet" | "bet_cancel" | "payout" | "refund" | "adjustment";
      market_category: "sports" | "campus" | "culture" | "crypto" | "news" | "other";
      market_status: "open" | "closed" | "resolved" | "voided";
      pool_status: "open" | "settled" | "refunded";
      settlement_kind: "settled" | "refunded";
      swipe_action: "yes" | "no" | "skip";
      user_role: "user" | "moderator" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      bet_side: ["yes", "no"],
      bet_status: ["active", "cancelled", "won", "lost", "refunded"],
      community_kind: ["school", "topic"],
      ledger_kind: ["signup_bonus", "daily_bonus", "bet", "bet_cancel", "payout", "refund", "adjustment"],
      market_category: ["sports", "campus", "culture", "crypto", "news", "other"],
      market_status: ["open", "closed", "resolved", "voided"],
      pool_status: ["open", "settled", "refunded"],
      settlement_kind: ["settled", "refunded"],
      swipe_action: ["yes", "no", "skip"],
      user_role: ["user", "moderator", "admin"],
    },
  },
} as const;
