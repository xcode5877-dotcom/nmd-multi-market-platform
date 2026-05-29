/** Read-only operational types for Super Admin driver hub (client aggregation). */

export interface DriverOpsMarketRow {
  marketId: string;
  marketName: string;
  marketSlug?: string;
  isActive: boolean;
  totalCouriers: number;
  activeCouriers: number;
  onlineCouriers: number;
  offlineCouriers: number;
  availableCouriers: number;
  queueCount: number;
  activeDeliveries: number;
  deliveriesToday: number;
}

export interface DriverOpsOverview {
  markets: DriverOpsMarketRow[];
  totals: {
    markets: number;
    couriers: number;
    activeCouriers: number;
    onlineCouriers: number;
    offlineCouriers: number;
    availableCouriers: number;
    activeDeliveries: number;
    queueCount: number;
    deliveriesToday: number;
    externalOrdersTotal: number;
    externalOrdersToday: number;
  };
  fetchedAt: string;
}

export interface DriverOpsMarketFinanceRow {
  marketId: string;
  marketName: string;
  gross: number;
  cashCollected: number;
  outstandingCash: number;
  deliveredOrders: number;
  courierRows: number;
}

export interface DriverOpsMarketReportRow {
  marketId: string;
  marketName: string;
  topDriverName: string | null;
  topDriverDeliveries: number;
  settlementEntries: number;
}
