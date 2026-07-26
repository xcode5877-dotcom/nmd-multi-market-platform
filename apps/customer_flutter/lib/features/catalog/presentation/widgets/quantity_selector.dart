import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../design_system/design_system.dart';
import '../../../../measurement/measurement.dart';

/// Measurement-aware quantity control.
/// PIECE/PACKAGE: ± stepper. WEIGHT/VOLUME: horizontal chips by server step.
class QuantitySelector extends StatelessWidget {
  const QuantitySelector({
    super.key,
    required this.measurement,
    required this.value,
    required this.onChanged,
    this.compact = false,
  });

  final ProductMeasurement measurement;
  final String value;
  final ValueChanged<String> onChanged;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (measurement.isWeighted) {
      return _WeightVolumeChips(
        measurement: measurement,
        value: value,
        onChanged: onChanged,
        compact: compact,
      );
    }
    return _PieceStepper(
      measurement: measurement,
      value: value,
      onChanged: onChanged,
      compact: compact,
    );
  }
}

class _PieceStepper extends StatelessWidget {
  const _PieceStepper({
    required this.measurement,
    required this.value,
    required this.onChanged,
    required this.compact,
  });

  final ProductMeasurement measurement;
  final String value;
  final ValueChanged<String> onChanged;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final label = formatQuantityFromMeasurement(value, measurement);
    final prev = previousQuantity(measurement, value);
    final next = nextQuantity(measurement, value);
    final size = compact ? 32.0 : 40.0;

    return Semantics(
      label: 'الكمية $label',
      child: Container(
        decoration: BoxDecoration(
          color: NmdColors.surfaceMuted.withValues(alpha: 0.85),
          borderRadius: NmdRadius.borderPill,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          textDirection: TextDirection.rtl,
          children: [
            _iconBtn(
              icon: Icons.remove_rounded,
              enabled: prev != null,
              size: size,
              onTap: prev == null
                  ? null
                  : () {
                      HapticFeedback.selectionClick();
                      onChanged(prev);
                    },
            ),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: compact ? 6 : 10),
              child: Text(
                label,
                style: NmdTypography.label.copyWith(
                  fontSize: compact ? 13 : 15,
                  color: NmdColors.brandPrimary,
                ),
              ),
            ),
            _iconBtn(
              icon: Icons.add_rounded,
              enabled: next != null,
              size: size,
              onTap: next == null
                  ? null
                  : () {
                      HapticFeedback.selectionClick();
                      onChanged(next);
                    },
            ),
          ],
        ),
      ),
    );
  }

  Widget _iconBtn({
    required IconData icon,
    required bool enabled,
    required double size,
    required VoidCallback? onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: NmdRadius.borderPill,
        child: SizedBox(
          width: size,
          height: size,
          child: Icon(
            icon,
            size: compact ? 16 : 20,
            color: enabled
                ? NmdColors.brandPrimary
                : NmdColors.textSecondary.withValues(alpha: 0.4),
          ),
        ),
      ),
    );
  }
}

class _WeightVolumeChips extends StatelessWidget {
  const _WeightVolumeChips({
    required this.measurement,
    required this.value,
    required this.onChanged,
    required this.compact,
  });

  final ProductMeasurement measurement;
  final String value;
  final ValueChanged<String> onChanged;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final options = buildQuantityOptions(measurement);
    final labels = quantityChipLabels(measurement, options);
    final normalized = coerceMeasurementDecimalString(value, measurement.minimumQuantity);

    return Semantics(
      label: 'اختر الكمية',
      child: SizedBox(
        height: compact ? 36 : 44,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          reverse: true,
          itemCount: options.length,
          separatorBuilder: (_, __) => SizedBox(width: compact ? 6 : 8),
          itemBuilder: (context, i) {
            final selected = options[i] == normalized;
            return Semantics(
              button: true,
              selected: selected,
              label: labels[i],
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    onChanged(options[i]);
                  },
                  borderRadius: NmdRadius.borderPill,
                  child: Ink(
                    padding: EdgeInsets.symmetric(
                      horizontal: compact ? 10 : 14,
                      vertical: compact ? 6 : 8,
                    ),
                    decoration: BoxDecoration(
                      color: selected
                          ? NmdColors.brandPrimary.withValues(alpha: 0.12)
                          : NmdColors.surfaceMuted,
                      borderRadius: NmdRadius.borderPill,
                      border: Border.all(
                        color: selected
                            ? NmdColors.brandPrimary
                            : NmdColors.borderSubtle,
                      ),
                    ),
                    child: Text(
                      labels[i],
                      style: NmdTypography.label.copyWith(
                        fontSize: compact ? 12 : 13,
                        fontWeight:
                            selected ? FontWeight.w800 : FontWeight.w600,
                        color: selected
                            ? NmdColors.brandPrimary
                            : NmdColors.textPrimary,
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
