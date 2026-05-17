import 'package:flutter/material.dart';

import '../localization/ar_strings.dart';
import '../theme/app_colors.dart';
import 'quest_gameplay_screen.dart';

class PathSelectionScreen extends StatelessWidget {
  const PathSelectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final portal = ArStrings.portal;
    final isRtl = Directionality.of(context) == TextDirection.rtl;

    return Scaffold(
      body: Stack(
        children: [
          Row(
            children: [
              Expanded(
                child: _WorldPane(
                  title: isRtl ? portal['architect']! : portal['technologist']!,
                  cta: isRtl
                      ? portal['architectCta']!
                      : portal['technologistCta']!,
                  color: const Color(0xFF102A43),
                  onTap: () => _openQuest(
                    context,
                    isRtl ? portal['architect']! : portal['technologist']!,
                  ),
                ),
              ),
              Expanded(
                child: _WorldPane(
                  title: isRtl ? portal['technologist']! : portal['architect']!,
                  cta: isRtl
                      ? portal['technologistCta']!
                      : portal['architectCta']!,
                  color: const Color(0xFF1F3D2B),
                  onTap: () => _openQuest(
                    context,
                    isRtl ? portal['technologist']! : portal['architect']!,
                  ),
                ),
              ),
            ],
          ),
          IgnorePointer(
            child: Center(
              child: Transform.rotate(
                angle: isRtl ? -0.52 : 0.52,
                child: Container(
                  width: 240,
                  height: 1400,
                  color: Colors.black.withValues(alpha: 0.2),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      portal['title']!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 28,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      portal['subtitle']!,
                      style: const TextStyle(color: Colors.white70),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openQuest(BuildContext context, String worldName) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => QuestGameplayScreen(worldName: worldName),
      ),
    );
  }
}

class _WorldPane extends StatelessWidget {
  const _WorldPane({
    required this.title,
    required this.cta,
    required this.color,
    required this.onTap,
  });

  final String title;
  final String cta;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [color, color.withValues(alpha: 0.85)],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 120, 18, 40),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Spacer(),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 16),
            _LuxuryPillButton(
              text: cta,
              onPressed: onTap,
            ),
          ],
        ),
      ),
    );
  }
}

class _LuxuryPillButton extends StatelessWidget {
  const _LuxuryPillButton({
    required this.text,
    required this.onPressed,
  });

  final String text;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        boxShadow: const [
          BoxShadow(
            color: Color(0x6614B8A6),
            blurRadius: 18,
            spreadRadius: 2,
          ),
        ],
      ),
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primaryTeal,
          foregroundColor: Colors.white,
          shape: const StadiumBorder(),
          minimumSize: const Size.fromHeight(52),
        ),
        child: Text(
          text,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}
