import type { CartInput, CartItem } from "../model/cart.schema";
export type {
  CartInput,
  CartItem,
  CartCommand,
  RestockEntry,
} from "../model/cart.schema";
export type CartData = {
  items: CartItem[];
  frequent: CartInput[];
  frequentSettings?: (CartInput & { hidden: boolean })[];
  networkError?: boolean;
  familyId: string;
  actorId: string;
  members: { user_id: string; display_name: string }[];
};
export type CartWriteResult = {
  undoToken?: string;
  duplicate?: CartItem;
  item?: CartItem;
  results?: {
    name: string;
    quantity: number;
    status: string;
    unit_id: string | null;
  }[];
};
