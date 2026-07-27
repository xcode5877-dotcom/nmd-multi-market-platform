import type { Application } from 'express';

type Layer = {
  route?: { path: string; methods: Record<string, boolean> };
  name?: string;
  handle?: { stack?: Layer[] };
  path?: string;
};

function walkStack(stack: Layer[] | undefined, basePath: string, out: string[]): void {
  if (!stack) return;
  for (const layer of stack) {
    if (layer.route?.path != null) {
      const pathStr = typeof layer.route.path === 'string' ? layer.route.path : String(layer.route.path);
      const full = `${basePath}${pathStr}`;
      const methods = Object.keys(layer.route.methods ?? {}).filter((k) => layer.route!.methods[k]);
      for (const m of methods) {
        out.push(`${m.toUpperCase().padEnd(7)} ${full}`);
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const mount =
        typeof layer.path === 'string' ? (layer.path === '/' ? '' : layer.path) : '';
      walkStack(layer.handle.stack, basePath + mount, out);
    }
  }
}

/** Log every Express route (string paths + nested routers). No `/v1` prefix is applied by this server. */
export function logExpressRoutes(app: Application, label = 'mock-api'): void {
  const out: string[] = [];
  const stack = (app as unknown as { _router?: { stack?: Layer[] } })._router?.stack;
  walkStack(stack, '', out);
  out.sort();
  console.log(`[${label}] Registered ${out.length} route handlers (no global /v1 prefix)`);
  for (const line of out) {
    console.log(`[${label}]`, line);
  }

  const required: { method: string; path: string }[] = [
    { method: 'POST', path: '/customer/payments/hyp/session' },
    { method: 'GET', path: '/customer/coins' },
    { method: 'GET', path: '/merchant/stats' },
  ];
  for (const r of required) {
    const ok = out.some((line) => {
      const parts = line.trim().split(/\s+/);
      const method = parts[0];
      const path = parts.slice(1).join(' ').trim();
      return method === r.method && path === r.path;
    });
    if (ok) {
      console.log(`[${label}] ✓ required route present: ${r.method} ${r.path}`);
    } else {
      console.warn(`[${label}] ✗ MISSING required route: ${r.method} ${r.path}`);
    }
  }
}
