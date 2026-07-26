/**
 * Phase B.1 — server-authoritative order line resolution (quantity, price, snapshots).
 *
 * Modifier rule (existing domain): option priceDelta is per base unit, then × quantity.
 * Campaigns: applied to unit price when available (PERCENT/FIXED), matching core applyCampaign.
 * Stock: integer CatalogProduct.stock with WEIGHT/VOLUME → WEIGHTED_STOCK_NOT_SUPPORTED.
 *         null/undefined stock → untracked (allowed).
 */

import {
  applyCampaign,
  buildAuthoritativeLineFields,
  calculateLineSubtotal,
  feeBillableItemUnits,
  moneyMismatch,
  normalizeAndValidateMeasurementForWrite,
  resolveProductMeasurementForRead,
  snapshotToMeasurement,
  validateQuantityAgainstMeasurement,
  type Campaign,
  type OrderQuantityError,
  type ProductMeasurement,
} from '@nmd/core';
import type { TenantCatalog } from './store.js';

export type ClientOrderLine = {
  id?: string;
  productId?: string;
  productName?: string;
  categoryId?: string;
  quantity?: unknown;
  quantityDecimal?: unknown;
  basePrice?: unknown;
  totalPrice?: unknown;
  customerUnitPrice?: unknown;
  selectedOptions?: unknown;
  optionGroups?: unknown;
  imageUrl?: string;
  [key: string]: unknown;
};

export type AuthoritativeOrderLine = ReturnType<typeof buildAuthoritativeLineFields> & {
  id: string;
  productId: string;
  productName: string;
  categoryId?: string;
  selectedOptions: unknown;
  optionGroups: unknown;
  imageUrl?: string;
  customerUnitPrice?: number;
};

export type ResolveLinesResult =
  | { ok: true; lines: AuthoritativeOrderLine[]; subtotal: number; feeItemCount: number }
  | { ok: false; status: number; body: Record<string, unknown> };

function fail(status: number, error: OrderQuantityError & { productId?: string; productName?: string }) {
  return {
    ok: false as const,
    status,
    body: {
      code: error.code,
      error: error.error,
      details: error.details,
      productId: error.productId ?? error.details?.productId,
      productName: error.productName,
    },
  };
}

function logOrderMeasurementEvent(
  event: string,
  meta: Record<string, unknown>
): void {
  console.warn(
    JSON.stringify({
      scope: 'measurement-v2-order',
      event,
      tenantId: meta.tenantId,
      productId: meta.productId,
      endpoint: meta.endpoint,
      code: meta.code,
      requestedQuantity: meta.requestedQuantity,
    })
  );
}

type CatalogProduct = Record<string, unknown> & {
  id?: string;
  name?: string;
  categoryId?: string;
  basePrice?: number;
  isAvailable?: boolean;
  isArchived?: boolean;
  stock?: number | null;
  imageUrl?: string;
  optionGroups?: unknown;
};

function findProduct(catalog: TenantCatalog, productId: string): CatalogProduct | undefined {
  return (catalog.products as CatalogProduct[] | undefined)?.find((p) => p.id === productId);
}

/** Sum selected option deltas (per base unit). Half-placement multipliers preserved from client selection shape. */
function resolveOptionUnitDelta(
  product: CatalogProduct,
  selectedOptions: unknown,
  catalogOptionGroups: unknown[]
): number {
  const groups = (
    Array.isArray(product.optionGroups) && (product.optionGroups as unknown[]).length > 0
      ? (product.optionGroups as unknown[])
      : catalogOptionGroups
  ) as Array<{
    id?: string;
    items?: Array<{ id?: string; priceDelta?: number; priceModifier?: number; customerPriceDelta?: number }>;
    allowHalfPlacement?: boolean;
  }>;
  const byId = new Map(groups.map((g) => [g.id, g]));
  let delta = 0;
  const sels = Array.isArray(selectedOptions) ? selectedOptions : [];
  for (const raw of sels) {
    const sel = raw as {
      optionGroupId?: string;
      optionItemIds?: string[];
      sliceSelection?: string;
      optionPlacements?: Record<string, string>;
    };
    const group = byId.get(sel.optionGroupId);
    if (!group?.items) continue;
    const ids = sel.optionItemIds ?? [];
    for (const id of ids) {
      const item = group.items.find((i) => i.id === id);
      if (!item) continue;
      const d = Number(item.priceDelta ?? item.priceModifier ?? 0) || 0;
      let mult = 1;
      if (group.allowHalfPlacement && sel.optionPlacements?.[id]) {
        const place = sel.optionPlacements[id];
        if (place === 'LEFT' || place === 'RIGHT') mult = 0.5;
      } else if (sel.sliceSelection === 'LEFT' || sel.sliceSelection === 'RIGHT') {
        mult = 0.5;
      }
      // Half multipliers are exact 1/2 — use agora via calculateLineSubtotal path later on unit sum.
      delta += d * mult;
    }
  }
  // Round option delta to agora to avoid float drift before line multiply
  return Math.round(delta * 100) / 100;
}

export function resolveAuthoritativeOrderLines(input: {
  tenantId: string;
  supportsWeightSelling: boolean;
  catalog: TenantCatalog;
  clientLines: ClientOrderLine[];
  campaigns?: Campaign[];
  endpoint: string;
}): ResolveLinesResult {
  const { tenantId, supportsWeightSelling, catalog, clientLines, campaigns = [], endpoint } = input;
  if (!Array.isArray(clientLines) || clientLines.length === 0) {
    return {
      ok: false,
      status: 400,
      body: { code: 'INVALID_QUANTITY', error: 'Order must include at least one item' },
    };
  }

  const lines: AuthoritativeOrderLine[] = [];
  let subtotalAgora = 0;
  let feeItemCount = 0;
  const catalogGroups = (catalog.optionGroups ?? []) as unknown[];

  for (const client of clientLines) {
    const productId = String(client.productId ?? '');
    if (!productId) {
      return fail(400, {
        code: 'INVALID_QUANTITY',
        error: 'productId is required',
        details: { requestedQuantity: client.quantityDecimal ?? client.quantity },
      });
    }
    const product = findProduct(catalog, productId);
    if (!product) {
      return {
        ok: false,
        status: 400,
        body: { code: 'INVALID_QUANTITY', error: 'Product not found', productId },
      };
    }
    if (product.isArchived === true || product.isAvailable === false) {
      return {
        ok: false,
        status: 400,
        body: {
          code: 'INVALID_QUANTITY',
          error: 'Product is not orderable',
          productId,
          productName: product.name,
        },
      };
    }

    const write = normalizeAndValidateMeasurementForWrite(product);
    if (!write.ok) {
      logOrderMeasurementEvent('invalid_measurement_config', {
        tenantId,
        productId,
        endpoint,
        code: 'INVALID_MEASUREMENT_CONFIG',
      });
      return {
        ok: false,
        status: 400,
        body: {
          code: 'INVALID_MEASUREMENT_CONFIG',
          error: write.error.error,
          details: write.error.details,
          productId,
          productName: product.name,
        },
      };
    }
    const measurement: ProductMeasurement = write.config;

    if (
      (measurement.measurementType === 'WEIGHT' || measurement.measurementType === 'VOLUME') &&
      !supportsWeightSelling
    ) {
      logOrderMeasurementEvent('measurement_not_supported', {
        tenantId,
        productId,
        endpoint,
        code: 'MEASUREMENT_NOT_SUPPORTED',
        requestedQuantity: client.quantityDecimal ?? client.quantity,
      });
      return fail(400, {
        code: 'MEASUREMENT_NOT_SUPPORTED',
        error: 'Weight/volume selling is not enabled for this store',
        details: {
          requestedQuantity: client.quantityDecimal ?? client.quantity,
          measurementType: measurement.measurementType,
          baseUnitCode: measurement.baseUnitCode,
          productId,
        },
        productId,
        productName: product.name,
      });
    }

    if (
      (measurement.measurementType === 'WEIGHT' || measurement.measurementType === 'VOLUME') &&
      product.stock != null
    ) {
      logOrderMeasurementEvent('weighted_stock_not_supported', {
        tenantId,
        productId,
        endpoint,
        code: 'WEIGHTED_STOCK_NOT_SUPPORTED',
      });
      return fail(400, {
        code: 'WEIGHTED_STOCK_NOT_SUPPORTED',
        error: 'Weighted products with integer stock tracking cannot be ordered',
        details: {
          productId,
          measurementType: measurement.measurementType,
          baseUnitCode: measurement.baseUnitCode,
        },
        productId,
        productName: product.name,
      });
    }

    const requestedQty = client.quantityDecimal ?? client.quantity;
    const qty = validateQuantityAgainstMeasurement(requestedQty, measurement, { productId });
    if (!qty.ok) {
      logOrderMeasurementEvent('rejected_invalid_quantity', {
        tenantId,
        productId,
        endpoint,
        code: qty.error.code,
        requestedQuantity: requestedQty,
      });
      return fail(400, { ...qty.error, productId, productName: product.name });
    }

    const catalogBase = Number(product.basePrice);
    if (!Number.isFinite(catalogBase) || catalogBase < 0) {
      return {
        ok: false,
        status: 400,
        body: { code: 'INVALID_QUANTITY', error: 'Product basePrice is invalid', productId },
      };
    }

    const optionDelta = resolveOptionUnitDelta(product, client.selectedOptions, catalogGroups);
    let unitPrice = Math.round((catalogBase + optionDelta) * 100) / 100;

    const campaignResult = applyCampaign(unitPrice, campaigns, productId, product.categoryId);
    if (campaignResult.discount > 0) {
      unitPrice = Math.round((unitPrice - campaignResult.discount) * 100) / 100;
      if (unitPrice < 0) unitPrice = 0;
    }

    const lineSubtotal = calculateLineSubtotal(unitPrice, qty.normalized);
    const lineAgora = Math.round(lineSubtotal * 100);
    subtotalAgora += lineAgora;
    feeItemCount += feeBillableItemUnits(measurement.measurementType, qty.milli);

    if (moneyMismatch(client.totalPrice, lineSubtotal) || moneyMismatch(client.basePrice, catalogBase)) {
      logOrderMeasurementEvent('client_server_price_mismatch', {
        tenantId,
        productId,
        endpoint,
        code: 'PRICE_MISMATCH',
        requestedQuantity: qty.normalized,
      });
    }

    const fields = buildAuthoritativeLineFields({
      measurement,
      quantityMilli: qty.milli,
      basePrice: Math.round(catalogBase * 100) / 100,
      unitPrice,
      lineSubtotal,
    });

    lines.push({
      ...fields,
      id: String(client.id ?? productId),
      productId,
      productName: String(client.productName ?? product.name ?? ''),
      categoryId: product.categoryId ? String(product.categoryId) : undefined,
      selectedOptions: client.selectedOptions ?? [],
      optionGroups: product.optionGroups ?? client.optionGroups ?? [],
      imageUrl: client.imageUrl ?? (product.imageUrl as string | undefined),
      customerUnitPrice: unitPrice,
      quantityStep: Number(measurement.quantityStep),
    });
  }

  return {
    ok: true,
    lines,
    subtotal: Math.round(subtotalAgora) / 100,
    feeItemCount,
  };
}

/** Validate quantity change against an existing line's snapshots (edit existing line). */
export function validateExistingLineQuantityChange(
  existingLine: Record<string, unknown>,
  requestedQuantity: unknown
):
  | { ok: true; quantityMilli: number; normalized: string; measurement: ProductMeasurement; lineSubtotal: number }
  | { ok: false; error: OrderQuantityError } {
  const hasSnap = existingLine.measurementTypeSnapshot != null;
  const measurement = hasSnap
    ? snapshotToMeasurement({
        measurementTypeSnapshot: existingLine.measurementTypeSnapshot as ProductMeasurement['measurementType'],
        baseUnitCodeSnapshot: existingLine.baseUnitCodeSnapshot as ProductMeasurement['baseUnitCode'],
        displayUnitCodeSnapshot: existingLine.displayUnitCodeSnapshot as ProductMeasurement['displayUnitCode'],
        quantityStepSnapshot: String(existingLine.quantityStepSnapshot ?? '1'),
        minimumQuantitySnapshot: String(existingLine.minimumQuantitySnapshot ?? '1'),
        maximumQuantitySnapshot:
          existingLine.maximumQuantitySnapshot == null
            ? null
            : String(existingLine.maximumQuantitySnapshot),
        priceBasisSnapshot: (existingLine.priceBasisSnapshot as ProductMeasurement['priceBasis']) ?? 'PER_BASE_UNIT',
        measurementVersionSnapshot: Number(existingLine.measurementVersionSnapshot ?? 1),
        displayPrecisionSnapshot:
          existingLine.displayPrecisionSnapshot == null
            ? null
            : Number(existingLine.displayPrecisionSnapshot),
      })
    : resolveProductMeasurementForRead(existingLine);

  const qty = validateQuantityAgainstMeasurement(requestedQuantity, measurement, {
    productId: String(existingLine.productId ?? ''),
  });
  if (!qty.ok) return qty;

  const unitPrice = Number(
    existingLine.unitPriceSnapshot ?? existingLine.basePriceSnapshot ?? existingLine.basePrice ?? 0
  );
  const lineSubtotal = calculateLineSubtotal(unitPrice, qty.normalized);
  return { ok: true, quantityMilli: qty.milli, normalized: qty.normalized, measurement, lineSubtotal };
}
