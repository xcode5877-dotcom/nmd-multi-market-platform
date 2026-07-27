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
  /**
   * Legacy numeric quantity. PIECE/PACKAGE: integer.
   * WEIGHT/VOLUME may be fractional (JSON number). Prefer quantityDecimal.
   */
  quantity: number;
  /** Authoritative quantity as decimal string in base units (Phase B.1). */
  quantityDecimal?: string;
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

  // --- Phase B.1 immutable snapshots (written at order create / add-line) ---
  measurementTypeSnapshot?: import('../measurement/types.js').MeasurementType;
  baseUnitCodeSnapshot?: import('../measurement/types.js').BaseUnitCode;
  displayUnitCodeSnapshot?: import('../measurement/types.js').DisplayUnitCode;
  quantityStepSnapshot?: string;
  minimumQuantitySnapshot?: string;
  maximumQuantitySnapshot?: string | null;
  priceBasisSnapshot?: import('../measurement/types.js').PriceBasis;
  measurementVersionSnapshot?: number;
  displayPrecisionSnapshot?: number | null;
  basePriceSnapshot?: number;
  unitPriceSnapshot?: number;
  /** Fixed per-line modifiers for WEIGHT/VOLUME; 0 when baked into unit (PIECE). */
  modifierLineSnapshot?: number;
  lineSubtotalSnapshot?: number;
}
