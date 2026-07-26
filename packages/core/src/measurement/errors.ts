import type { MeasurementConfigError } from './types.js';

/**
 * Thrown by catalog write boundaries when any product has an invalid
 * explicit measurement configuration. Callers must abort the write and
 * leave the previous catalog unchanged.
 */
export class InvalidMeasurementConfigError extends Error {
  readonly code = 'INVALID_MEASUREMENT_CONFIG' as const;
  readonly details?: Record<string, unknown>;
  readonly messageAr?: string;
  readonly productId?: string;
  readonly productName?: string;

  constructor(
    error: MeasurementConfigError,
    meta?: { productId?: string; productName?: string }
  ) {
    super(error.error);
    this.name = 'InvalidMeasurementConfigError';
    this.details = error.details;
    this.messageAr = error.messageAr;
    this.productId = meta?.productId;
    this.productName = meta?.productName;
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      error: this.message,
      messageAr: this.messageAr,
      details: this.details,
      productId: this.productId,
      productName: this.productName,
    };
  }
}

export function isInvalidMeasurementConfigError(err: unknown): err is InvalidMeasurementConfigError {
  return err instanceof InvalidMeasurementConfigError ||
    (typeof err === 'object' &&
      err != null &&
      (err as { code?: string }).code === 'INVALID_MEASUREMENT_CONFIG' &&
      (err as { name?: string }).name === 'InvalidMeasurementConfigError');
}
