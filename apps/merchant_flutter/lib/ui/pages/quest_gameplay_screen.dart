import 'package:flutter/material.dart';

import '../localization/ar_strings.dart';

class QuestGameplayScreen extends StatelessWidget {
  const QuestGameplayScreen({
    super.key,
    required this.worldName,
  });

  final String worldName;

  @override
  Widget build(BuildContext context) {
    final quests = ArStrings.quests;
    return Scaffold(
      appBar: AppBar(
        title: Text(quests['physicsTitle']!),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '${quests['selectedWorld']}: $worldName',
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.right,
            ),
            const SizedBox(height: 12),
            Text(
              quests['physicsSubtitle']!,
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.right,
            ),
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  quests['objective']!,
                  textAlign: TextAlign.right,
                ),
              ),
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: () {},
              child: Text(quests['start']!),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(quests['back']!),
            ),
          ],
        ),
      ),
    );
  }
}
