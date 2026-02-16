// src/delivery-store.ts
var STORAGE_KEY = "nmd.delivery";
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
  }
  return {};
}
function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function getDeliverySettings(tenantId) {
  const data = load();
  return data[tenantId] ?? null;
}
function saveDeliverySettings(tenantId, settings) {
  const data = load();
  data[tenantId] = { ...settings, tenantId };
  save(data);
}

export {
  getDeliverySettings,
  saveDeliverySettings
};
//# sourceMappingURL=chunk-77ON5LVH.js.map