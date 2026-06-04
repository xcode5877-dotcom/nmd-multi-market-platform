import 'dart:convert';

import 'package:flutter/material.dart';

import '../../../../api/models/pizza_placement.dart';
import '../../../../design_system/design_system.dart';
import '../../domain/cart_selected_option.dart';
import 'pizza_side_indicator.dart';

/// One resolved modifier for display (Arabic label + placement for icon).
final class ModifierLineData {
  const ModifierLineData({required this.placement, required this.text});

  final String placement;
  final String text;
}

List<ModifierLineData> modifierLinesFromCart(
  List<CartSelectedOption> selected,
  String optionGroupsJson,
) {
  if (selected.isEmpty) return const [];

  List<dynamic> groupsDecoded;
  try {
    final d = jsonDecode(optionGroupsJson);
    groupsDecoded = d is List ? d : const [];
  } catch (_) {
    groupsDecoded = const [];
  }

  String? nameFor(String groupId, String itemId) {
    for (final g in groupsDecoded) {
      if (g is! Map) continue;
      final gid = g['id']?.toString() ?? '';
      if (gid != groupId) continue;
      final items = g['items'];
      if (items is! List) continue;
      for (final it in items) {
        if (it is! Map) continue;
        final iid = it['id']?.toString() ?? '';
        if (iid == itemId) {
          final n = it['name']?.toString().trim() ?? '';
          return n.isNotEmpty ? n : null;
        }
      }
    }
    return null;
  }

  final out = <ModifierLineData>[];
  for (final sel in selected) {
    for (final id in sel.optionItemIds) {
      final rawPl = sel.optionPlacements[id] ?? PizzaPlacement.defaultPlacement;
      final pl = rawPl.toUpperCase();
      final optName = nameFor(sel.optionGroupId, id) ?? '';
      final label =
          optName.isNotEmpty ? formatAddonNameWithPlacementAr(optName, pl) : id;
      out.add(ModifierLineData(placement: pl, text: label));
    }
  }
  return out;
}

List<ModifierLineData> modifierLinesFromOrderItem(Map<String, dynamic> item) {
  final selRaw = item['selectedOptions'];
  if (selRaw is! List || selRaw.isEmpty) return const [];

  final groupsDecoded = item['optionGroups'] is List
      ? item['optionGroups'] as List<dynamic>
      : const <dynamic>[];

  String? nameFor(String groupId, String itemId) {
    for (final g in groupsDecoded) {
      if (g is! Map) continue;
      final gid = g['id']?.toString() ?? '';
      if (gid != groupId) continue;
      final items = g['items'];
      if (items is! List) continue;
      for (final it in items) {
        if (it is! Map) continue;
        final iid = it['id']?.toString() ?? '';
        if (iid == itemId) {
          final n = it['name']?.toString().trim() ?? '';
          return n.isNotEmpty ? n : null;
        }
      }
    }
    return null;
  }

  final out = <ModifierLineData>[];
  for (final raw in selRaw) {
    if (raw is! Map) continue;
    final gid = raw['optionGroupId']?.toString() ?? '';
    final ids = raw['optionItemIds'];
    final idList =
        ids is List ? ids.map((e) => e.toString()).toList() : <String>[];
    final plMap = raw['optionPlacements'];
    final placements = plMap is Map
        ? plMap.map((k, v) => MapEntry(k.toString(), v.toString()))
        : <String, String>{};

    for (final id in idList) {
      final rawPl = placements[id] ?? PizzaPlacement.defaultPlacement;
      final pl = rawPl.toUpperCase();
      final optName = nameFor(gid, id) ?? '';
      final label =
          optName.isNotEmpty ? formatAddonNameWithPlacementAr(optName, pl) : id;
      out.add(ModifierLineData(placement: pl, text: label));
    }
  }
  return out;
}

/// Cart row: Arabic modifier lines + [PizzaSideIndicator].
class CartModifierLines extends StatelessWidget {
  const CartModifierLines({
    super.key,
    required this.selectedOptions,
    required this.optionGroupsJson,
    this.compact = false,
  });

  final List<CartSelectedOption> selectedOptions;
  final String optionGroupsJson;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final rows = modifierLinesFromCart(selectedOptions, optionGroupsJson);
    return ModifierLinesColumn(rows: rows, compact: compact);
  }
}

/// Order history / API item map.
class OrderItemModifierLines extends StatelessWidget {
  const OrderItemModifierLines({
    super.key,
    required this.item,
    this.compact = false,
  });

  final Map<String, dynamic> item;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final rows = modifierLinesFromOrderItem(item);
    return ModifierLinesColumn(rows: rows, compact: compact);
  }
}

class ModifierLinesColumn extends StatelessWidget {
  const ModifierLinesColumn({
    super.key,
    required this.rows,
    this.compact = false,
  });

  final List<ModifierLineData> rows;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) SizedBox(height: compact ? 2 : 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Flexible(
                child: Text(
                  rows[i].text,
                  textAlign: TextAlign.right,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: NmdTypography.label.copyWith(
                    fontSize: compact ? 11 : 12,
                    color: NmdColors.textSecondary.withValues(alpha: 0.98),
                    height: compact ? 1.3 : 1.35,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              PizzaSideIndicator(
                placement: rows[i].placement,
                size: compact ? 16 : 18,
              ),
            ],
          ),
        ],
      ],
    );
  }
}
