// P2/P3/P4 migration contract. Regenerate with `supabase gen types typescript --local`
// after applying the migration to a local Supabase instance.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
type Table<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};
// Entities supply their domain unions without making shared depend on them.
type UserRow<Provider extends string> = {
  id: string;
  provider: Provider;
  provider_user_id: string;
  display_name: string;
  terms_accepted_at: string;
  privacy_accepted_at: string;
  terms_version: string;
  push_enabled: boolean;
  morning_summary_time: string;
  home_view: string;
  upcoming_enabled: boolean;
  upcoming_count: number;
};
type FamilyRow = { id: string; name: string };
type MembershipRow<Role extends string> = {
  user_id: string;
  family_id: string;
  role: Role;
};
type InviteRow = {
  token: string;
  family_id: string;
  created_by: string;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
};
export type Database<
  Role extends string = string,
  Provider extends string = string,
> = {
  public: {
    Tables: {
      push_subscriptions: Table<
        { user_id: string; endpoint: string; keys: Json; created_at: string },
        { user_id: string; endpoint: string; keys: Json; created_at?: string }
      >;
      notifications: Table<
        {
          id: string;
          user_id: string;
          family_id: string;
          kind: string;
          payload: Json;
          read_at: string | null;
          created_at: string;
        },
        {
          user_id: string;
          family_id: string;
          kind: string;
          payload: Json;
          read_at?: string | null;
          created_at?: string;
          id?: string;
        }
      >;
      event_categories: Table<
        {
          id: string;
          family_id: string;
          name: string;
          color: string;
          sort_order: number;
        },
        {
          id?: string;
          family_id: string;
          name: string;
          color: string;
          sort_order: number;
        }
      >;
      events: Table<
        {
          id: string;
          family_id: string;
          owner_id: string | null;
          visibility: string;
          start_date: string;
          end_date: string;
          start_time: string | null;
          end_time: string | null;
          is_all_day: boolean;
          kind: string;
        },
        {
          id?: string;
          family_id: string;
          owner_id: string;
          visibility?: string;
          start_date: string;
          end_date: string;
          start_time: string | null;
          end_time: string | null;
          is_all_day?: boolean;
          kind?: string;
        }
      >;
      event_details: Omit<
        Table<
          {
            event_id: string;
            family_id: string;
            title: string;
            place: string;
            memo: string;
            category_id: string;
            dday_style: string;
            celebrate_message: string;
            remind_before: number | null;
          },
          {
            event_id: string;
            family_id: string;
            title: string;
            place?: string;
            memo?: string;
            category_id: string;
            dday_style?: string;
            celebrate_message?: string;
            remind_before?: number | null;
          }
        >,
        "Relationships"
      > & {
        Relationships: [
          {
            foreignKeyName: "event_details_event_id_family_id_fkey";
            columns: ["event_id", "family_id"];
            isOneToOne: true;
            referencedRelation: "events";
            referencedColumns: ["id", "family_id"];
          },
        ];
      };
      dday_card_dismissals: Table<
        { user_id: string; event_id: string; year: number },
        { user_id: string; event_id: string; year: number }
      >;
      users: Table<
        UserRow<Provider>,
        Omit<
          UserRow<Provider>,
          | "home_view"
          | "upcoming_enabled"
          | "upcoming_count"
          | "push_enabled"
          | "morning_summary_time"
        > &
          Partial<
            Pick<
              UserRow<Provider>,
              | "home_view"
              | "upcoming_enabled"
              | "upcoming_count"
              | "push_enabled"
              | "morning_summary_time"
            >
          >
      >;
      families: Table<FamilyRow, { id?: string; name: string }>;
      memberships: Table<MembershipRow<Role>, MembershipRow<Role>>;
      invites: Table<
        InviteRow,
        {
          token?: string;
          family_id: string;
          created_by: string;
          expires_at?: string;
          accepted_by?: string | null;
          accepted_at?: string | null;
        }
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      notification_worker: {
        Args: { worker_secret: string; operation: string; input?: Json };
        Returns: Json;
      };
      save_event: {
        Args: {
          event_id: string | null;
          event_title: string;
          event_place: string;
          event_memo: string;
          event_category_id: string;
          event_visibility: string;
          event_start_date: string;
          event_end_date: string;
          event_start_time: string | null;
          event_end_time: string | null;
          event_is_all_day: boolean;
          event_remind_before?: number | null;
          event_kind?: string;
          event_dday_style?: string;
          event_celebrate_message?: string;
        };
        Returns: string;
      };
      save_notification_settings: {
        Args: { push_enabled: boolean; morning_summary_time: string };
        Returns: undefined;
      };
      save_home_settings: {
        Args: {
          home_view: string;
          upcoming_enabled: boolean;
          upcoming_count: number;
        };
        Returns: undefined;
      };
      dismiss_dday_card: { Args: { event_id: string }; Returns: undefined };
      delete_event: { Args: { event_id: string }; Returns: undefined };
      save_event_category: {
        Args: {
          category_id: string | null;
          category_name: string;
          category_color: string;
          category_sort_order: number;
        };
        Returns: string;
      };
      delete_event_category: {
        Args: { category_id: string };
        Returns: undefined;
      };
      complete_profile: {
        Args: {
          display_name: string;
          terms_accepted: boolean;
          privacy_accepted: boolean;
        };
        Returns: undefined;
      };
      create_family: { Args: { family_name: string }; Returns: string };
      create_invite: { Args: Record<string, never>; Returns: Json };
      preview_invite: { Args: { invite_token: string }; Returns: Json };
      accept_invite: { Args: { invite_token: string }; Returns: string };
      family_members: {
        Args: Record<string, never>;
        Returns: { user_id: string; display_name: string; role: Role }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
