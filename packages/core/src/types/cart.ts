import type { OptionGroup } from './product';

export interface SelectedOption {
  optionGroupId: string;
  optionItemIds: string[];
}

export type PizzaPlacement = 'WHOLE' | 'LEFT' | 'RIGHT';

export interface PizzaSelectedOption {
  optionGroupId: string;
  sliceSelection: 'WHOLE' | 'LEFT' | 'RIGHT';
  optionItemIds: string[];
  /** Per-option placement when group has allowHalfPlacement. optionId -> WHOLE|LEFT|RIGHT. Default WHOLE. */
  optionPlacements?: Record<string, PizzaPlacement>;
}

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  categoryId?: string;
  quantity: number;
  basePrice: number;
  /** Repriced customer unit (base + options markup) before campaigns; merchant base stays in basePrice. */
  customerUnitPrice?: number;
  selectedOptions: SelectedOption[] | PizzaSelectedOption[];
  optionGroups: OptionGroup[];
  totalPrice: number;
  imageUrl?: string;
  /** Quantity increment (e.g. 0.5 for kg). Default 1. Used for +/- and display. */
  quantityStep?: number;
  /** Unit label (e.g. "كيلو", "حبة"). For display next to quantity. */
  unitName?: string;
  /** When true, item is sold by weight (decimals); when false, strict integer and "حبة". */
  isWeightBased?: boolean;
}
