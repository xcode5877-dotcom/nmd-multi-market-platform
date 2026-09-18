import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/cart/application/cart_cubit.dart';
import 'package:customer_flutter/features/support/presentation/widgets/support_floating_capsule.dart';
import 'package:customer_flutter/features/support/presentation/widgets/support_floating_hub_host.dart';
import 'package:customer_flutter/widgets/global_nmd_header.dart';

void main() {
  testWidgets('header exposes support action without floating capsule overlay', (tester) async {
    await tester.pumpWidget(
      BlocProvider(
        create: (_) => CartCubit(),
        child: MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                GlobalNmdHeader(
                  marketSlug: 'dabburiyya',
                  title: 'Now Market',
                  onLeadingPressed: () {},
                ),
                const Expanded(child: ColoredBox(color: Colors.white)),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.byIcon(Icons.headset_mic_outlined), findsOneWidget);
    expect(find.byType(SupportFloatingCapsule), findsNothing);
    expect(find.byType(SupportFloatingHubHost), findsNothing);
  });
}
