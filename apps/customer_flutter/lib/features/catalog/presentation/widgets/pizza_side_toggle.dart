import 'package:flutter/material.dart';

import '../../../../api/models/pizza_placement.dart';
import '../../../../design_system/design_system.dart';

/// Premium segmented selector for pizza placement (same values as web/API).
class PizzaSideToggle extends StatelessWidget {
  const PizzaSideToggle({
    super.key,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final bool enabled;

  static const _segments = <_PlacementSegment>[
    _PlacementSegment(
      value: PizzaPlacement.whole,
      label: 'كامل',
    ),
    _PlacementSegment(
      value: PizzaPlacement.right,
      label: 'نصف يمين',
    ),
    _PlacementSegment(
      value: PizzaPlacement.left,
      label: 'نصف يسار',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final selected = value.toUpperCase();
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: NmdColors.surfaceMuted,
          borderRadius: NmdRadius.borderMd,
          border: const Border.fromBorderSide(
            BorderSide(color: NmdColors.borderSubtle),
          ),
        ),
        child: Row(
          children: [
            for (var i = 0; i < _segments.length; i++) ...[
              if (i > 0) const SizedBox(width: 6),
              Expanded(
                child: _SegmentChip(
                  label: _segments[i].label,
                  selected: selected == _segments[i].value,
                  enabled: enabled,
                  onTap: enabled
                      ? () => onChanged(_segments[i].value)
                      : null,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PlacementSegment {
  const _PlacementSegment({required this.value, required this.label});

  final String value;
  final String label;
}

class _SegmentChip extends StatelessWidget {
  const _SegmentChip({
    required this.label,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final bg = selected ? NmdColors.brandPrimary : Colors.transparent;
    final fg = selected
        ? NmdColors.textOnBrand
        : (enabled ? NmdColors.textPrimary : NmdColors.textTertiary);

    return Material(
      color: bg,
      borderRadius: NmdRadius.borderSm,
      child: InkWell(
        onTap: onTap,
        borderRadius: NmdRadius.borderSm,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            child: Center(
              child: Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: NmdTypography.label.copyWith(
                  color: fg,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
