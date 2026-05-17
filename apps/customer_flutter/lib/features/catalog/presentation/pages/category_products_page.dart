import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../api/models/product.dart';
import '../../../../api/storefront_api.dart';
import '../../../../app/theme/app_colors.dart';
import '../../data/pillar_kind.dart';
import '../../data/tenant_contact_info.dart';
import '../widgets/retail_product_card.dart';
import '../widgets/service_product_card.dart';

class _CategoryProductsPayload {
  const _CategoryProductsPayload({
    required this.products,
    required this.isServicesStore,
    required this.tenantIdForLeads,
    required this.contact,
    required this.officeContact,
  });

  final List<Product> products;
  final bool isServicesStore;
  final String tenantIdForLeads;
  final TenantContactInfo contact;
  final TenantContactInfo officeContact;
}

class CategoryProductsPage extends StatefulWidget {
  const CategoryProductsPage({
    super.key,
    required this.marketSlug,
    required this.storeId,
    required this.categoryId,
    this.title,
  });

  final String marketSlug;
  final String storeId;
  final String categoryId;
  final String? title;

  @override
  State<CategoryProductsPage> createState() => _CategoryProductsPageState();
}

class _CategoryProductsPageState extends State<CategoryProductsPage> {
  late Future<_CategoryProductsPayload> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_CategoryProductsPayload> _load() async {
    final api = StorefrontApi(context.read<Dio>());
    final market = await api.getMarketBySlug(widget.marketSlug);
    final marketId = market['id']?.toString();
    if (marketId == null || marketId.isEmpty) {
      throw Exception('Market missing');
    }
    final pillars = await api.getPillars();
    final tenant = await api.getTenantDetails(marketId, widget.storeId);
    final pillarIdRaw = tenant['pillarId'] ?? tenant['pillar_id'];
    final isServicesStore =
        isServicesPillarForTenant(pillarIdRaw?.toString(), pillars);
    final tenantIdForLeads = (tenant['id'] ?? widget.storeId).toString().trim();
    final officeContact = tenantContactFromTenantMap(tenant);

    final products = await api.getCatalogProducts(widget.storeId);
    List<Product> list;
    if (widget.categoryId == 'other') {
      final categories = await api.getCatalogCategories(widget.storeId);
      final ids = categories.map((c) => c.id).toSet();
      list = products.where((p) => !ids.contains(p.categoryId)).toList();
    } else {
      list = products.where((p) => p.categoryId == widget.categoryId).toList();
    }
    return _CategoryProductsPayload(
      products: list,
      isServicesStore: isServicesStore,
      tenantIdForLeads: tenantIdForLeads,
      contact: const TenantContactInfo(),
      officeContact: officeContact,
    );
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.title == null || widget.title!.trim().isEmpty
        ? 'عرض الكل'
        : widget.title!.trim();
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          backgroundColor: AppColors.shellTeal,
          foregroundColor: Colors.white,
          centerTitle: false,
          title: Text(
            title,
            textAlign: TextAlign.right,
            style: GoogleFonts.cairo(fontWeight: FontWeight.w800),
          ),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded),
            onPressed: () => context.pop(),
          ),
        ),
        body: FutureBuilder<_CategoryProductsPayload>(
          future: _future,
          builder: (context, snap) {
            if (snap.hasError) {
              return Center(child: Text(snap.error.toString()));
            }
            if (!snap.hasData) {
              return const Center(
                  child:
                      CircularProgressIndicator(color: AppColors.primaryTeal));
            }
            final payload = snap.data!;
            final products = payload.products;
            if (products.isEmpty) {
              return const Center(child: Text('لا توجد منتجات في هذا القسم'));
            }
            if (payload.isServicesStore) {
              return GridView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: products.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 14,
                  mainAxisExtent: ServiceProductCard.cardHeight,
                ),
                itemBuilder: (context, i) {
                  final p = products[i];
                  final heroTag = 'product-${widget.storeId}-${p.id}-grid';
                  return LayoutBuilder(
                    builder: (context, constraints) {
                      return ServiceProductCard(
                        width: constraints.maxWidth,
                        name: p.name,
                        price: p.basePrice,
                        imageUrl: p.imageUrl,
                        available: p.canAddToCart,
                        heroTag: heroTag,
                        onOpenDetail: () => context.push(
                          '/market/${widget.marketSlug}/store/${widget.storeId}/product/${p.id}',
                        ),
                      );
                    },
                  );
                },
              );
            }
            return GridView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: products.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                mainAxisExtent: RetailProductCard.cardHeight,
              ),
              itemBuilder: (context, i) {
                final p = products[i];
                final heroTag = 'product-${widget.storeId}-${p.id}-grid';
                return LayoutBuilder(
                  builder: (context, constraints) {
                    return RetailProductCard(
                      width: constraints.maxWidth,
                      name: p.name,
                      price: p.basePrice,
                      imageUrl: p.imageUrl,
                      available: p.canAddToCart,
                      heroTag: heroTag,
                      onTap: () => context.push(
                        '/market/${widget.marketSlug}/store/${widget.storeId}/product/${p.id}',
                      ),
                    );
                  },
                );
              },
            );
          },
        ),
      ),
    );
  }
}
