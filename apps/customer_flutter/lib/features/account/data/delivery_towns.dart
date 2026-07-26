/// Supported delivery towns for profile default + checkout zone matching.
const List<String> kNmdDeliveryTowns = <String>[
  'دبورية',
  'إكسال',
  'شبلي',
  'أم الغنم',
  'طمرة',
  'الناعورة',
  'نين',
  'الطيبة',
  'كفر مصر',
];

String? matchZoneIdForTown(List<Map<String, dynamic>> zones, String? town) {
  final t = town?.trim() ?? '';
  if (t.isEmpty || zones.isEmpty) return null;
  for (final z in zones) {
    final name = z['name']?.toString().trim() ?? '';
    if (name == t) return z['id']?.toString();
  }
  for (final z in zones) {
    final name = z['name']?.toString() ?? '';
    final first = name.split('/').first.trim();
    if (name.contains(t) || t.contains(first)) {
      return z['id']?.toString();
    }
  }
  return null;
}
