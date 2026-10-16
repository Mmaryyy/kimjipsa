// P2 migration contract. Regenerate with `supabase gen types typescript --local`
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
      users: Table<UserRow<Provider>, UserRow<Provider>>;
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
