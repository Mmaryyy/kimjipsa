type CartRow = {
  id: string;
  created_at: string;
  family_id: string;
  name: string;
  quantity: number;
  unit_id: string | null;
  category_id: string | null;
  memo: string;
  link_url: string;
  added_by: string | null;
  checked_by: string | null;
  is_checked: boolean;
  inventory_item_id: string | null;
  purchased_at: string | null;
};
type InventoryRow = {
  id: string;
  family_id: string;
  name: string;
  mode: string;
  quantity: number;
  status: string;
  unit_id: string | null;
  category_id: string | null;
  location_id: string | null;
  min_quantity: number | null;
  expires_on: string | null;
};
type InventoryMetaRow = {
  id: string;
  family_id: string;
  name: string;
  sort_order: number;
  enabled?: boolean;
  icon_kind?: string | null;
  icon_value?: string;
};
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
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  terms_version: string | null;
  push_enabled: boolean;
  morning_summary_time: string;
  home_view: string;
  upcoming_enabled: boolean;
  upcoming_count: number;
};
type FamilyRow = { id: string; name: string; expiry_days: number };
type MembershipRow<Role extends string> = {
  user_id: string;
  family_id: string;
  role: Role;
};
type InviteRow = {
  token: string;
  family_id: string;
  created_by: string | null;
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
      cart_items: Table<CartRow, CartRow>;
      inventory_items: Table<InventoryRow, InventoryRow>;
      inventory_categories: Table<InventoryMetaRow, InventoryMetaRow>;
      locations: Table<InventoryMetaRow, InventoryMetaRow>;
      units: Table<InventoryMetaRow, InventoryMetaRow>;
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
          recurrence: string | null;
          recurrence_until: string | null;
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
      event_exceptions: Omit<
        Table<
          {
            event_id: string;
            original_date: string;
            family_id: string;
            cancelled: boolean;
            start_date: string;
            end_date: string;
            start_time: string | null;
            end_time: string | null;
            is_all_day: boolean;
          },
          never
        >,
        "Relationships"
      > & { Relationships: [] };
      event_exception_details: Omit<
        Table<
          {
            event_id: string;
            original_date: string;
            family_id: string;
            title: string;
            place: string;
            memo: string;
            category_id: string;
            remind_before: number | null;
          },
          never
        >,
        "Relationships"
      > & {
        Relationships: [
          {
            foreignKeyName: "event_exception_details_event_id_original_date_family_id_fkey";
            columns: ["event_id", "original_date", "family_id"];
            isOneToOne: true;
            referencedRelation: "event_exceptions";
            referencedColumns: ["event_id", "original_date", "family_id"];
          },
        ];
      };
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
          created_by: string | null;
          expires_at?: string;
          accepted_by?: string | null;
          accepted_at?: string | null;
        }
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      agent_read: {
        Args: { input?: Json };
        Returns: Json;
      };
      chat_page: {
        Args: { input?: Json };
        Returns: Json;
      };
      chat_command: {
        Args: { operation: string; input?: Json };
        Returns: Json;
      };
      agent_command: {
        Args: { operation: string; input?: Json };
        Returns: Json;
      };
      agent_cleanup: {
        Args: { worker_secret: string; operation: string; input?: Json };
        Returns: Json;
      };
      withdraw_account: { Args: Record<string, never>; Returns: undefined };
      change_member_role: {
        Args: { member_id: string; member_role: Role };
        Returns: undefined;
      };
      frequent_cart_items: { Args: Record<string, never>; Returns: CartRow[] };
      undo_cart_restock: { Args: { token: string }; Returns: Json };
      write_cart: { Args: { payload: Json }; Returns: Json };
      write_inventory: { Args: { payload: Json }; Returns: string };
      write_inventory_meta: { Args: { payload: Json }; Returns: undefined };
      notification_worker: {
        Args: { worker_secret: string; operation: string; input?: Json };
        Returns: Json;
      };
      save_event: {
        Args: {
          event_recurrence?: string | null;
          occurrence_date?: string | null;
          edit_scope?: string | null;
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
      delete_event: {
        Args: {
          event_id: string;
          occurrence_date?: string | null;
          edit_scope?: string | null;
        };
        Returns: undefined;
      };
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
