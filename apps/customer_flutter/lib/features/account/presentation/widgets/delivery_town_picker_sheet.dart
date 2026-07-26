import 'package:flutter/material.dart';

import '../../../../design_system/design_system.dart';

/// Searchable RTL bottom sheet for selecting a supported delivery town.
Future<String?> showDeliveryTownPickerSheet(
  BuildContext context, {
  required List<String> towns,
  String? selectedTown,
  String title = 'اختر منطقتك الرئيسية',
  String searchHint = 'بحث عن منطقة...',
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _DeliveryTownPickerSheet(
      towns: towns,
      selectedTown: selectedTown,
      title: title,
      searchHint: searchHint,
    ),
  );
}

class _DeliveryTownPickerSheet extends StatefulWidget {
  const _DeliveryTownPickerSheet({
    required this.towns,
    this.selectedTown,
    required this.title,
    required this.searchHint,
  });

  final List<String> towns;
  final String? selectedTown;
  final String title;
  final String searchHint;

  @override
  State<_DeliveryTownPickerSheet> createState() =>
      _DeliveryTownPickerSheetState();
}

class _DeliveryTownPickerSheetState extends State<_DeliveryTownPickerSheet> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<String> get _filtered {
    final q = _query.trim();
    if (q.isEmpty) return widget.towns;
    return widget.towns.where((t) => t.contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Padding(
        padding: EdgeInsets.only(bottom: bottomInset),
        child: Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.85,
          ),
          decoration: const BoxDecoration(
            color: NmdColors.surfaceBase,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: NmdSpacing.sm),
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: NmdColors.borderSubtle,
                    borderRadius: NmdRadius.borderPill,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    NmdSpacing.screenHorizontal,
                    NmdSpacing.md,
                    NmdSpacing.screenHorizontal,
                    NmdSpacing.xs,
                  ),
                  child: Text(widget.title, style: NmdTypography.h3),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: NmdSpacing.screenHorizontal,
                  ),
                  child: TextField(
                    controller: _searchCtrl,
                    textAlign: TextAlign.right,
                    decoration: InputDecoration(
                      hintText: widget.searchHint,
                      prefixIcon: const Icon(Icons.search_rounded),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      isDense: true,
                    ),
                    onChanged: (v) => setState(() => _query = v),
                  ),
                ),
                const SizedBox(height: NmdSpacing.xs),
                const Divider(height: 1, color: NmdColors.borderSubtle),
                Flexible(
                  child: _filtered.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(NmdSpacing.lg),
                          child: Text(
                            'لا توجد نتائج',
                            style: NmdTypography.bodySmall.copyWith(
                              color: NmdColors.textSecondary,
                            ),
                          ),
                        )
                      : ListView.builder(
                          shrinkWrap: true,
                          itemCount: _filtered.length,
                          itemBuilder: (context, i) {
                            final town = _filtered[i];
                            final selected = widget.selectedTown == town;
                            return ListTile(
                              title: Text(
                                town,
                                style: NmdTypography.label.copyWith(
                                  fontWeight: selected
                                      ? FontWeight.w800
                                      : FontWeight.w600,
                                  color: selected
                                      ? NmdColors.brandPrimary
                                      : NmdColors.textPrimary,
                                ),
                              ),
                              leading: Icon(
                                selected
                                    ? Icons.radio_button_checked_rounded
                                    : Icons.radio_button_off_rounded,
                                color: selected
                                    ? NmdColors.brandPrimary
                                    : NmdColors.textTertiary,
                              ),
                              onTap: () => Navigator.of(context).pop(town),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
