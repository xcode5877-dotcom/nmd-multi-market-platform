// src/orders-store.ts
var STORAGE_KEY = "nmd.orders";
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
  }
  return [];
}
function save(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}
function listOrders() {
  return load();
}
function listOrdersByTenant(tenantId) {
  return load().filter((o) => o.tenantId === tenantId);
}
function getOrder(id) {
  return load().find((o) => o.id === id) ?? null;
}
function updateOrderStatus(id, status) {
  const orders = load();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], status };
  save(orders);
  return orders[idx];
}
function getOrdersToday() {
  const today = (/* @__PURE__ */ new Date()).toDateString();
  return load().filter((o) => new Date(o.createdAt).toDateString() === today);
}
function getOrdersThisWeek() {
  const weekAgo = /* @__PURE__ */ new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return load().filter((o) => new Date(o.createdAt) >= weekAgo);
}
function addOrder(order) {
  const orders = load();
  orders.push(order);
  save(orders);
}

export {
  listOrders,
  listOrdersByTenant,
  getOrder,
  updateOrderStatus,
  getOrdersToday,
  getOrdersThisWeek,
  addOrder
};
//# sourceMappingURL=chunk-SAU2GD47.js.map