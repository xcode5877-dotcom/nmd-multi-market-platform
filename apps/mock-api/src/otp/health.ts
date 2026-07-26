import { otpDeliveryQueue } from './delivery-queue.js';
import type { OtpDeliveryProvider } from './types.js';

const UNHEALTHY_ALERT_MS = Number(process.env.OTP_UNHEALTHY_ALERT_MS) || 5 * 60 * 1000;

type AlertState = {
  unhealthySince: number | null;
  lastWarningAt: number | null;
};

const alertState: AlertState = {
  unhealthySince: null,
  lastWarningAt: null,
};

export type OtpSystemDiagnostics = {
  at: string;
  providers: Array<{
    name: string;
    configured: boolean;
    healthy: boolean;
    detail?: Record<string, unknown>;
  }>;
  queue: ReturnType<typeof otpDeliveryQueue.stats>;
  anyProviderHealthy: boolean;
  alert: {
    unhealthyForMs: number;
    warningRaised: boolean;
  };
  lastSuccessfulDeliveryAt: string | null;
  lastFailureAt: string | null;
  lastFailureError: string | null;
};

let lastSuccessfulDeliveryAt: string | null = null;

export function markOtpDeliverySuccess(): void {
  lastSuccessfulDeliveryAt = new Date().toISOString();
  alertState.unhealthySince = null;
}

export function markOtpDeliveryFailure(error?: string): void {
  void error;
  if (alertState.unhealthySince == null) {
    alertState.unhealthySince = Date.now();
  }
}

export async function collectOtpDiagnostics(providers: OtpDeliveryProvider[]): Promise<OtpSystemDiagnostics> {
  const providerStates = [];
  for (const p of providers) {
    const h = await p.health();
    providerStates.push({
      name: p.name,
      configured: h.configured,
      healthy: h.healthy,
      detail: h.detail,
    });
  }

  const configured = providerStates.filter((p) => p.configured);
  const anyProviderHealthy = configured.some((p) => p.healthy);
  const now = Date.now();

  if (!anyProviderHealthy && configured.length > 0) {
    if (alertState.unhealthySince == null) alertState.unhealthySince = now;
  } else if (anyProviderHealthy) {
    alertState.unhealthySince = null;
  }

  const unhealthyForMs =
    alertState.unhealthySince != null ? Math.max(0, now - alertState.unhealthySince) : 0;
  let warningRaised = false;
  if (unhealthyForMs >= UNHEALTHY_ALERT_MS) {
    const shouldLog =
      alertState.lastWarningAt == null || now - alertState.lastWarningAt >= UNHEALTHY_ALERT_MS;
    if (shouldLog) {
      alertState.lastWarningAt = now;
      warningRaised = true;
      console.warn(
        JSON.stringify({
          level: 'warning',
          event: 'OTP_PROVIDER_UNHEALTHY',
          unhealthyForMs,
          providers: providerStates,
          queue: otpDeliveryQueue.stats(),
          at: new Date().toISOString(),
        }),
      );
    }
  }

  const q = otpDeliveryQueue.stats();
  return {
    at: new Date().toISOString(),
    providers: providerStates,
    queue: q,
    anyProviderHealthy,
    alert: { unhealthyForMs, warningRaised },
    lastSuccessfulDeliveryAt,
    lastFailureAt: q.lastFailureAt,
    lastFailureError: q.lastFailureError,
  };
}

/** Periodic watchdog — call from index bootstrap. */
export function startOtpHealthWatchdog(getProviders: () => OtpDeliveryProvider[], intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => {
    void collectOtpDiagnostics(getProviders()).catch((e) => {
      console.warn('[OTP-HEALTH] watchdog error:', e instanceof Error ? e.message : e);
    });
  }, intervalMs);
}
