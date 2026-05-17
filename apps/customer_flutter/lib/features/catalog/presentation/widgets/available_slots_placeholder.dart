import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../app/theme/app_colors.dart';

/// Web parity: [AvailableSlotsPlaceholder] — حجز المواعيد لاحقاً.
class AvailableSlotsPlaceholder extends StatelessWidget {
  const AvailableSlotsPlaceholder({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE5E7EB), width: 2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primaryTeal.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.calendar_month_rounded,
                      color: AppColors.primaryTeal, size: 22),
                ),
                const SizedBox(width: 12),
                Text(
                  'المواعيد المتاحة',
                  style: GoogleFonts.cairo(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF111827),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              'قريباً: حجز المواعيد مباشرة من الموقع',
              style: GoogleFonts.cairo(
                fontSize: 14,
                color: const Color(0xFF6B7280),
                height: 1.45,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
