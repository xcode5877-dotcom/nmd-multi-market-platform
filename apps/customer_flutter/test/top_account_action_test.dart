import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/cart/application/cart_cubit.dart';
import 'package:customer_flutter/widgets/global_nmd_header.dart';

void main() {
  testWidgets('top person icon is present and tappable', (tester) async {
    await tester.pumpWidget(
      BlocProvider(
        create: (_) => CartCubit(),
        child: MaterialApp(
          home: Scaffold(
            body: GlobalNmdHeader(
              marketSlug: 'dabburiyya',
              title: 'Now Market',
              onLeadingPressed: () {},
            ),
          ),
        ),
      ),
    );

    final person = find.byTooltip('حسابي');
    expect(person, findsOneWidget);
    final support = find.byTooltip('المساعدة');
    expect(support, findsOneWidget);

    final supportCenter = tester.getCenter(support);
    final accountCenter = tester.getCenter(person);
    expect((supportCenter - accountCenter).distance, greaterThan(8));
  });
}
