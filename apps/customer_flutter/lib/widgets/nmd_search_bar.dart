import 'package:flutter/material.dart';

import '../app/theme/app_colors.dart';

class NmdSearchBar extends StatelessWidget {
  const NmdSearchBar({
    super.key,
    this.controller,
    this.focusNode,
    this.onChanged,
    this.hintText = 'Search products, stores, categories...',
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x330F766E), width: 2),
      ),
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        onChanged: onChanged,
        textDirection: TextDirection.rtl,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: const Color(0xFF0F172A),
              fontWeight: FontWeight.w600,
            ),
        decoration: InputDecoration(
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          hintText: hintText,
          hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: const Color(0xFF94A3B8),
                fontWeight: FontWeight.w500,
              ),
          suffixIcon: const Padding(
            padding: EdgeInsets.only(right: 8),
            child: Icon(Icons.search, color: AppColors.primaryTeal),
          ),
          suffixIconConstraints:
              const BoxConstraints(minWidth: 40, minHeight: 40),
        ),
      ),
    );
  }
}
