import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../api/models/product.dart';

class ProductPage extends StatefulWidget {
  const ProductPage({
    super.key,
    required this.tenantId,
    required this.productId,
  });

  final String tenantId;
  final String productId;

  @override
  State<ProductPage> createState() => _ProductPageState();
}

class _ProductPageState extends State<ProductPage> {
  late Future<Map<String, dynamic>> _future;
  int _qty = 1;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final dio = context.read<Dio>();
    final catalog =
        await dio.get<Map<String, dynamic>>('/catalog/${widget.tenantId}');
    final products = (catalog.data?['products'] as List<dynamic>? ?? [])
        .whereType<Map>()
        .toList();
    final product = products.firstWhere(
      (p) => p['id']?.toString() == widget.productId,
      orElse: () => <String, dynamic>{},
    );
    return Map<String, dynamic>.from(product);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snap) {
          if (!snap.hasData) {
            return const Center(
                child: CircularProgressIndicator(color: AppColors.primaryTeal));
          }
          final product = snap.data!;
          final parsed = Product.fromJson(product);
          final name = parsed.name;
          final description = parsed.description;
          final imageUrl = parsed.imageUrl;
          final price = parsed.basePrice;

          return Stack(
            children: [
              CustomScrollView(
                primary: true,
                slivers: [
                  SliverAppBar(
                    pinned: true,
                    backgroundColor: AppColors.shellTeal,
                    foregroundColor: Colors.white,
                    title: const Text('تفاصيل المنتج'),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AspectRatio(
                            aspectRatio: 4 / 5,
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(18),
                              child: imageUrl.isEmpty
                                  ? const ColoredBox(color: Color(0xFFF1F5F9))
                                  : Image.network(imageUrl, fit: BoxFit.cover),
                            ),
                          ),
                          const SizedBox(height: 14),
                          Text(name,
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineSmall
                                  ?.copyWith(fontWeight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          Text('₪${price.toStringAsFixed(2)}',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(
                                      color: AppColors.primaryTeal,
                                      fontWeight: FontWeight.w800)),
                          const SizedBox(height: 12),
                          Text(
                            description.isEmpty
                                ? 'لا يوجد وصف متاح حالياً.'
                                : description,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: SafeArea(
                  top: false,
                  child: Container(
                    color: Colors.white,
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                    child: Row(
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0x330F766E)),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Row(
                            children: [
                              IconButton(
                                onPressed: () => setState(
                                    () => _qty = _qty > 1 ? _qty - 1 : 1),
                                icon: const Text('−',
                                    style: TextStyle(
                                        color: AppColors.primaryTeal,
                                        fontSize: 18)),
                              ),
                              Text('$_qty',
                                  style: const TextStyle(
                                      color: AppColors.primaryTeal,
                                      fontWeight: FontWeight.w700)),
                              IconButton(
                                onPressed: () => setState(() => _qty++),
                                icon: const Text('+',
                                    style: TextStyle(
                                        color: AppColors.primaryTeal,
                                        fontSize: 18)),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: SizedBox(
                            height: 46,
                            child: ElevatedButton(
                              onPressed: () {},
                              child: const Text('أضف للسلة'),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
