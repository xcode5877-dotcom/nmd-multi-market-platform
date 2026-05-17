import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/auth/ensure_customer_auth.dart';
import '../../application/cart_cubit.dart';
import '../widgets/cart_modifier_lines.dart';

class CartPage extends StatelessWidget {
  const CartPage({super.key});

  @override
  Widget build(BuildContext context) {
    final slug = GoRouterState.of(context).pathParameters['slug'] ?? '';

    return ColoredBox(
      color: Colors.white,
      child: Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          backgroundColor: AppColors.shellTeal,
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded),
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/market/$slug');
              }
            },
          ),
          title: const Text('السلة'),
        ),
        body: BlocBuilder<CartCubit, List<CartLine>>(
          builder: (context, lines) {
            if (lines.isEmpty) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.shopping_bag_outlined,
                          size: 56,
                          color: AppColors.primaryTeal.withValues(alpha: 0.45)),
                      const SizedBox(height: 16),
                      Text(
                        'السلة فارغة',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'تصفّح المتاجر وأضف منتجاتك هنا',
                        textAlign: TextAlign.center,
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: const Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
              );
            }

            final total = lines.fold<double>(0, (s, e) => s + e.lineTotal);

            return Column(
              children: [
                Expanded(
                  child: ListView.separated(
                    primary: true,
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    itemCount: lines.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final line = lines[i];
                      return Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: SizedBox(
                                  width: 64,
                                  height: 64,
                                  child: line.imageUrl.isEmpty
                                      ? const ColoredBox(
                                          color: Color(0xFFF1F5F9))
                                      : Image.network(
                                          line.imageUrl,
                                          fit: BoxFit.cover,
                                          errorBuilder: (_, __, ___) =>
                                              const ColoredBox(
                                                  color: Color(0xFFF1F5F9)),
                                        ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      line.name,
                                      textAlign: TextAlign.right,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleSmall
                                          ?.copyWith(
                                              fontWeight: FontWeight.w700),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '₪${line.unitPrice.toStringAsFixed(2)} × ${line.quantity}',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                              color: const Color(0xFF64748B)),
                                    ),
                                    if (line.selectedOptions.isNotEmpty) ...[
                                      const SizedBox(height: 6),
                                      CartModifierLines(
                                        selectedOptions: line.selectedOptions,
                                        optionGroupsJson: line.optionGroupsJson,
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              Column(
                                children: [
                                  IconButton(
                                    onPressed: () => context
                                        .read<CartCubit>()
                                        .removeLine(line.lineKey),
                                    icon: const Icon(Icons.delete_outline,
                                        color: Color(0xFF94A3B8)),
                                  ),
                                  Text(
                                    '₪${line.lineTotal.toStringAsFixed(2)}',
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleSmall
                                        ?.copyWith(
                                          color: AppColors.primaryTeal,
                                          fontWeight: FontWeight.w800,
                                        ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                SafeArea(
                  top: false,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'الإجمالي',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            Text(
                              '₪${total.toStringAsFixed(2)}',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(
                                    color: AppColors.primaryTeal,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 52,
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.primaryTeal,
                              foregroundColor: AppColors.textOnTeal,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(999)),
                            ),
                            onPressed: () async {
                              final ok = await ensureCustomerAuth(context);
                              if (!context.mounted || !ok) return;
                              context.push('/market/$slug/checkout');
                            },
                            child: const Text('إتمام الطلب'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
