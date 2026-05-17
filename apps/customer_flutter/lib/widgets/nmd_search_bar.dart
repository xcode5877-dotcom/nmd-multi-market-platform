import 'package:flutter/material.dart';

import '../design_system/design_system.dart';

class NmdSearchBar extends StatelessWidget {
  const NmdSearchBar({
    super.key,
    this.controller,
    this.focusNode,
    this.onChanged,
    this.hintText = 'بحث باسم المحل...',
  });

  final TextEditingController? controller;
  final FocusNode? focusNode;
  final ValueChanged<String>? onChanged;
  final String hintText;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: NmdColors.surfaceBase,
        borderRadius: NmdRadius.borderPill,
        border: Border.all(color: NmdColors.borderBrand, width: 1.5),
        boxShadow: NmdShadows.sm,
      ),
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        onChanged: onChanged,
        textDirection: TextDirection.rtl,
        style: NmdTypography.body,
        decoration: InputDecoration(
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            vertical: 14,
            horizontal: NmdSpacing.md,
          ),
          hintText: hintText,
          hintStyle:
              NmdTypography.bodySmall.copyWith(color: NmdColors.textTertiary),
          suffixIcon: const Padding(
            padding: EdgeInsets.only(right: 8),
            child: Icon(Icons.search_rounded, color: NmdColors.brandPrimary),
          ),
          suffixIconConstraints:
              const BoxConstraints(minWidth: 40, minHeight: 40),
        ),
      ),
    );
  }
}
