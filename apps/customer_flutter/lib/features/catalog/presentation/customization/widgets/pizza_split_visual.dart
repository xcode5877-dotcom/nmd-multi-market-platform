import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../../../api/models/pizza_placement.dart';
import '../modifier_group_presentation.dart';
import '../pizza_topping_positioner.dart';
import '../pizza_topping_visual_resolver.dart';
import 'pizza_topping_glyph.dart';

/// Realistic pizza half/half builder preview with organic topping scatter.
class PizzaSplitVisual extends StatelessWidget {
  const PizzaSplitVisual({
    super.key,
    required this.leftLabels,
    required this.rightLabels,
    required this.wholeLabels,
    this.groupName,
    this.pizzaSize = 148,
  });

  final List<String> leftLabels;
  final List<String> rightLabels;
  final List<String> wholeLabels;
  final String? groupName;
  final double pizzaSize;

  bool get _halfMode => leftLabels.isNotEmpty || rightLabels.isNotEmpty;
  bool get _fullMode => !_halfMode && wholeLabels.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final items = _layoutItems();
    final glyphs = PizzaToppingPositioner.layoutScene(
      pizzaSize: pizzaSize,
      items: items,
      groupName: groupName,
      visualFor: (item) => PizzaToppingVisualResolver.resolve(
        modifierName: item.modifierName,
        groupName: groupName,
        placement: item.placement,
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: pizzaSize + 10,
          child: Row(
            textDirection: TextDirection.rtl,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: _SideColumn(
                  title: 'النصف الأيمن',
                  labels: rightLabels,
                  placement: PizzaPlacement.right,
                  groupName: groupName,
                  align: CrossAxisAlignment.end,
                ),
              ),
              const SizedBox(width: 6),
              RepaintBoundary(
                child: _PizzaCanvas(
                  pizzaSize: pizzaSize,
                  glyphs: glyphs,
                  showSplitLine: _halfMode,
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: _SideColumn(
                  title: 'النصف الأيسر',
                  labels: leftLabels,
                  placement: PizzaPlacement.left,
                  groupName: groupName,
                  align: CrossAxisAlignment.start,
                ),
              ),
            ],
          ),
        ),
        if (_modeSummary != null) ...[
          const SizedBox(height: 6),
          Text(
            _modeSummary!,
            textAlign: TextAlign.center,
            style: NmdTypography.micro.copyWith(
              color: NmdColors.textSecondary.withValues(alpha: 0.95),
            ),
          ),
        ],
      ],
    );
  }

  String? get _modeSummary {
    if (_fullMode) {
      return ModifierGroupPresentationResolver.pizzaFullModeSummary();
    }
    if (_halfMode) {
      return ModifierGroupPresentationResolver.pizzaHalfVisualHint();
    }
    return null;
  }

  List<PizzaToppingLayoutItem> _layoutItems() {
    final items = <PizzaToppingLayoutItem>[];
    void addAll(List<String> names, String placement) {
      for (final name in names) {
        final visual = PizzaToppingVisualResolver.resolve(
          modifierName: name,
          groupName: groupName,
          placement: placement,
        );
        items.add(
          PizzaToppingLayoutItem(
            modifierKey: name,
            modifierName: name,
            placement: placement,
            category: visual.category,
          ),
        );
      }
    }

    addAll(wholeLabels, PizzaPlacement.whole);
    addAll(rightLabels, PizzaPlacement.right);
    addAll(leftLabels, PizzaPlacement.left);
    return items;
  }
}

class _PizzaCanvas extends StatelessWidget {
  const _PizzaCanvas({
    required this.pizzaSize,
    required this.glyphs,
    required this.showSplitLine,
  });

  final double pizzaSize;
  final List<PizzaToppingGlyphLayout> glyphs;
  final bool showSplitLine;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: pizzaSize + 10,
      height: pizzaSize + 10,
      decoration: BoxDecoration(
        color: NmdColors.surfaceBase,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 16,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: SizedBox(
        width: pizzaSize,
        height: pizzaSize,
        child: Stack(
          clipBehavior: Clip.hardEdge,
          children: [
            ClipOval(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  PizzaBaseImage(size: pizzaSize),
                  if (showSplitLine)
                    Center(
                      child: Container(
                        width: 1.5,
                        height: pizzaSize * 0.76,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.white.withValues(alpha: 0.0),
                              Colors.white.withValues(alpha: 0.85),
                              Colors.white.withValues(alpha: 0.0),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            ...glyphs.map(
              (g) => _AnimatedToppingGlyph(
                key: ValueKey(g.key),
                layout: g,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AnimatedToppingGlyph extends StatefulWidget {
  const _AnimatedToppingGlyph({super.key, required this.layout});

  final PizzaToppingGlyphLayout layout;

  @override
  State<_AnimatedToppingGlyph> createState() => _AnimatedToppingGlyphState();
}

class _AnimatedToppingGlyphState extends State<_AnimatedToppingGlyph>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;
  late final Animation<double> _opacity;
  late final Animation<double> _rotation;

  @override
  void initState() {
    super.initState();
    final delay = Duration(milliseconds: 35 * widget.layout.staggerIndex);
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 340),
    );
    _scale = Tween<double>(begin: 0.72, end: widget.layout.scaleFactor).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack),
    );
    _opacity = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic),
    );
    _rotation = Tween<double>(
      begin: widget.layout.rotationRadians * 0.4,
      end: widget.layout.rotationRadians,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));

    Future<void>.delayed(delay, () {
      if (mounted) _ctrl.forward();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final g = widget.layout;
    return Positioned(
      left: g.position.dx,
      top: g.position.dy,
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (context, child) => Opacity(
          opacity: _opacity.value,
          child: Transform.rotate(
            angle: _rotation.value,
            child: Transform.scale(
              scale: _scale.value,
              child: child,
            ),
          ),
        ),
        child: PizzaToppingGlyph(
          visual: g.visual,
          size: g.size,
        ),
      ),
    );
  }
}

class _SideColumn extends StatelessWidget {
  const _SideColumn({
    required this.title,
    required this.labels,
    required this.placement,
    required this.groupName,
    required this.align,
  });

  final String title;
  final List<String> labels;
  final String placement;
  final String? groupName;
  final CrossAxisAlignment align;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: align,
      children: [
        Text(
          title,
          style: NmdTypography.micro.copyWith(
            fontSize: 9,
            color: NmdColors.brandPrimary.withValues(alpha: 0.9),
            fontWeight: FontWeight.w800,
            letterSpacing: 0.2,
          ),
        ),
        const SizedBox(height: 3),
        if (labels.isEmpty)
          Text(
            '—',
            style: NmdTypography.micro.copyWith(
              color: NmdColors.textTertiary,
              fontSize: 9,
            ),
          )
        else
          ...labels.take(3).map((name) {
            final visual = PizzaToppingVisualResolver.resolve(
              modifierName: name,
              groupName: groupName,
              placement: placement,
            );
            return Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                textDirection: TextDirection.rtl,
                children: [
                  PizzaToppingGlyph(
                    visual: visual,
                    size: 14,
                    dropShadow: false,
                  ),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: NmdTypography.micro.copyWith(
                        fontSize: 9,
                        color: NmdColors.textPrimary.withValues(alpha: 0.88),
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }
}
