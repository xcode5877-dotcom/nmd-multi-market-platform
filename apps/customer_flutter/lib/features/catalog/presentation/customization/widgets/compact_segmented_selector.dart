import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../customization_tokens.dart';

/// Compact horizontal segmented control (RTL-safe).
class CompactSegmentedSelector<T> extends StatelessWidget {
  const CompactSegmentedSelector({
    super.key,
    required this.segments,
    required this.selected,
    required this.labelBuilder,
    required this.onSelected,
    this.enabled = true,
  });

  final List<T> segments;
  final T selected;
  final String Function(T value) labelBuilder;
  final ValueChanged<T> onSelected;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        padding: const EdgeInsets.all(CustomizationTokens.xxs),
        decoration: BoxDecoration(
          color: NmdColors.surfaceMuted,
          borderRadius: BorderRadius.circular(CustomizationTokens.chipRadius),
          border: const Border.fromBorderSide(
            BorderSide(color: NmdColors.borderSubtle),
          ),
        ),
        child: Row(
          children: [
            for (var i = 0; i < segments.length; i++) ...[
              if (i > 0) const SizedBox(width: CustomizationTokens.xxs),
              Expanded(
                child: _SegmentButton(
                  label: labelBuilder(segments[i]),
                  selected: segments[i] == selected,
                  enabled: enabled,
                  onTap: enabled ? () => onSelected(segments[i]) : null,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SegmentButton extends StatelessWidget {
  const _SegmentButton({
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
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: CustomizationTokens.chipMinHeight - 4,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: CustomizationTokens.xs,
              vertical: CustomizationTokens.xxs + 2,
            ),
            child: Center(
              child: Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: NmdTypography.label.copyWith(
                  color: fg,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
