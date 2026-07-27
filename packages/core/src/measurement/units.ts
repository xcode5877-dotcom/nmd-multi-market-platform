import type {
  BaseUnitCode,
  DisplayUnitCode,
  MeasurementType,
  PrismaBaseUnitCode,
  PrismaDisplayUnitCode,
} from './types.js';

export const MEASUREMENT_TYPES: readonly MeasurementType[] = ['PIECE', 'WEIGHT', 'VOLUME', 'PACKAGE'] as const;
export const BASE_UNIT_CODES: readonly BaseUnitCode[] = ['kg', 'l', 'piece', 'pack', 'box', 'bundle'] as const;
export const DISPLAY_UNIT_CODES: readonly DisplayUnitCode[] = [
  'kg',
  'g',
  'l',
  'ml',
  'piece',
  'pack',
  'box',
  'bundle',
] as const;

const API_TO_PRISMA_BASE: Record<BaseUnitCode, PrismaBaseUnitCode> = {
  kg: 'KG',
  l: 'L',
  piece: 'PIECE',
  pack: 'PACK',
  box: 'BOX',
  bundle: 'BUNDLE',
};

const API_TO_PRISMA_DISPLAY: Record<DisplayUnitCode, PrismaDisplayUnitCode> = {
  kg: 'KG',
  g: 'G',
  l: 'L',
  ml: 'ML',
  piece: 'PIECE',
  pack: 'PACK',
  box: 'BOX',
  bundle: 'BUNDLE',
};

const PRISMA_TO_API_BASE: Record<string, BaseUnitCode> = {
  KG: 'kg',
  L: 'l',
  PIECE: 'piece',
  PACK: 'pack',
  BOX: 'box',
  BUNDLE: 'bundle',
  // tolerate lowercase already
  kg: 'kg',
  l: 'l',
  piece: 'piece',
  pack: 'pack',
  box: 'box',
  bundle: 'bundle',
};

const PRISMA_TO_API_DISPLAY: Record<string, DisplayUnitCode> = {
  KG: 'kg',
  G: 'g',
  L: 'l',
  ML: 'ml',
  PIECE: 'piece',
  PACK: 'pack',
  BOX: 'box',
  BUNDLE: 'bundle',
  kg: 'kg',
  g: 'g',
  l: 'l',
  ml: 'ml',
  piece: 'piece',
  pack: 'pack',
  box: 'box',
  bundle: 'bundle',
};

export function toPrismaBaseUnitCode(code: BaseUnitCode): PrismaBaseUnitCode {
  return API_TO_PRISMA_BASE[code];
}

export function toPrismaDisplayUnitCode(code: DisplayUnitCode): PrismaDisplayUnitCode {
  return API_TO_PRISMA_DISPLAY[code];
}

export function fromPrismaBaseUnitCode(raw: unknown): BaseUnitCode | null {
  if (raw == null) return null;
  return PRISMA_TO_API_BASE[String(raw)] ?? null;
}

export function fromPrismaDisplayUnitCode(raw: unknown): DisplayUnitCode | null {
  if (raw == null) return null;
  return PRISMA_TO_API_DISPLAY[String(raw)] ?? null;
}

export function parseMeasurementType(raw: unknown): MeasurementType | null {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  return (MEASUREMENT_TYPES as readonly string[]).includes(s) ? (s as MeasurementType) : null;
}

export function parseBaseUnitCode(raw: unknown): BaseUnitCode | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  // Also accept Prisma-style
  return fromPrismaBaseUnitCode(s) ?? fromPrismaBaseUnitCode(String(raw).trim().toUpperCase());
}

export function parseDisplayUnitCode(raw: unknown): DisplayUnitCode | null {
  if (raw == null) return null;
  return fromPrismaDisplayUnitCode(String(raw).trim()) ?? fromPrismaDisplayUnitCode(String(raw).trim().toUpperCase());
}

/** Arabic labels for displayUnitCode (dual-emit unitName + formatQuantity). */
export function arabicUnitLabel(displayUnitCode: DisplayUnitCode): string {
  switch (displayUnitCode) {
    case 'kg':
      return 'كغم';
    case 'g':
      return 'غرام';
    case 'l':
      return 'لتر';
    case 'ml':
      return 'مل';
    case 'piece':
      return 'حبة';
    case 'pack':
      return 'علبة';
    case 'box':
      return 'كرتونة';
    case 'bundle':
      return 'ربطة';
    default:
      return 'حبة';
  }
}

export function isPairAllowed(type: MeasurementType, base: BaseUnitCode, display: DisplayUnitCode): boolean {
  switch (type) {
    case 'WEIGHT':
      return base === 'kg' && (display === 'kg' || display === 'g');
    case 'VOLUME':
      return base === 'l' && (display === 'l' || display === 'ml');
    case 'PIECE':
      return base === 'piece' && display === 'piece';
    case 'PACKAGE':
      return (
        (base === 'pack' || base === 'box' || base === 'bundle') && display === base
      );
    default:
      return false;
  }
}

export function defaultDisplayForBase(type: MeasurementType, base: BaseUnitCode): DisplayUnitCode {
  if (type === 'WEIGHT') return 'kg';
  if (type === 'VOLUME') return 'l';
  if (type === 'PIECE') return 'piece';
  return base as DisplayUnitCode;
}
