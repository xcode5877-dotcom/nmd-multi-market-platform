/**
 * In-process OTP delivery queue.
 * HTTP handlers enqueue work and await a bounded acknowledgement — never hang forever.
 */

export type QueuedJob<T> = {
  id: string;
  enqueuedAt: number;
  run: () => Promise<T>;
};

export type OtpQueueStats = {
  size: number;
  active: number;
  completed: number;
  failed: number;
  lastEnqueueAt: string | null;
  lastCompleteAt: string | null;
  lastFailureAt: string | null;
  lastFailureError: string | null;
};

export class OtpDeliveryQueue {
  private size = 0;
  private active = 0;
  private completed = 0;
  private failed = 0;
  private lastEnqueueAt: string | null = null;
  private lastCompleteAt: string | null = null;
  private lastFailureAt: string | null = null;
  private lastFailureError: string | null = null;
  private seq = 0;

  stats(): OtpQueueStats {
    return {
      size: this.size,
      active: this.active,
      completed: this.completed,
      failed: this.failed,
      lastEnqueueAt: this.lastEnqueueAt,
      lastCompleteAt: this.lastCompleteAt,
      lastFailureAt: this.lastFailureAt,
      lastFailureError: this.lastFailureError,
    };
  }

  /**
   * Run job with overall timeout. Increments queue counters for diagnostics.
   */
  async enqueueAndAwait<T>(run: () => Promise<T>, timeoutMs: number): Promise<T> {
    const id = `otp-${++this.seq}-${Date.now()}`;
    this.size += 1;
    this.active += 1;
    this.lastEnqueueAt = new Date().toISOString();
    try {
      const result = await Promise.race([
        run(),
        new Promise<T>((_, reject) => {
          setTimeout(() => reject(new Error(`OTP_DELIVERY_TIMEOUT after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
      this.completed += 1;
      this.lastCompleteAt = new Date().toISOString();
      return result;
    } catch (e) {
      this.failed += 1;
      this.lastFailureAt = new Date().toISOString();
      this.lastFailureError = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      this.size = Math.max(0, this.size - 1);
      this.active = Math.max(0, this.active - 1);
      void id;
    }
  }
}

export const otpDeliveryQueue = new OtpDeliveryQueue();
