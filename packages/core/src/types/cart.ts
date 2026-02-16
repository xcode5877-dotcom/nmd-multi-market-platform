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
  selectedOptions: SelectedOption[] | PizzaSelectedOption[];
  optionGroups: OptionGroup[];
  totalPrice: number;
  imageUrl?: string;
}
