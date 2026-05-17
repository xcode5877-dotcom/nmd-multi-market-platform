import 'pillar_nav_item.dart';

/// True when the tenant belongs to the **خدمات** (services) pillar — professional / booking UX, not grocery tiles.
bool isServicesPillarForTenant(String? pillarId, List<PillarNavItem> pillars) {
  if (pillarId == null || pillarId.trim().isEmpty) return false;
  final id = pillarId.trim();
  for (final p in pillars) {
    if (p.id.trim() == id) {
      return _isServicesPillar(p);
    }
  }
  return false;
}

bool _isServicesPillar(PillarNavItem p) {
  final t = p.titleAr.trim();
  if (t == 'خدمات') return true;
  final s = p.slug.trim().toLowerCase();
  return s == 'services' || s == 'service' || s == 'khdmat';
}
