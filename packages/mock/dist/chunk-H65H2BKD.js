// src/delivery-zones-store.ts
var STORAGE_KEY = "nmd.delivery-zones";
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
function getDeliveryZones(tenantId) {
  return load()[tenantId] ?? [];
}
function setDeliveryZones(tenantId, zones) {
  const data = load();
  data[tenantId] = zones;
  save(data);
}

export {
  getDeliveryZones,
  setDeliveryZones
};
//# sourceMappingURL=chunk-H65H2BKD.js.map