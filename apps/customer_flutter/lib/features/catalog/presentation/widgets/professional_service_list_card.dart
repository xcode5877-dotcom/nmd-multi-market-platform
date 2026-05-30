import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../api/models/product.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../application/service_lead_actions.dart';
import '../../data/tenant_contact_info.dart';

const Color _kProfessionalAccent = Color(0xFF00695C);

/// Web [ServiceCard] parity: صورة + عنوان + وصف + سعر/عند الطلب + تفاصيل + استفسر الآن.
class ProfessionalServiceListCard extends StatelessWidget {
  const ProfessionalServiceListCard({
    super.key,
    required this.product,
    required this.marketSlug,
    required this.storeId,
    required this.tenantIdForLeads,
    required this.officeContact,
  });

  final Product product;
  final String marketSlug;
  final String storeId;
  final String tenantIdForLeads;

  /// Store/office — product rows inherit these when the service has no own numbers.
  final TenantContactInfo officeContact;

  bool get _hasPrice => product.customerListPrice > 0;

  Future<void> _inquire(BuildContext context) async {
    final dio = context.read<Dio>();
    final auth = context.read<AuthBloc>().state;
    final customerPhone = auth.step == AuthStep.done ? auth.phone : null;
    await launchWhatsAppInquiry(
      dio: dio,
      tenantId: tenantIdForLeads,
      contact: const TenantContactInfo(),
      tenantContact: officeContact,
      serviceName: product.name,
      customerPhone: customerPhone,
      context: context,
    );
  }

  @override
  Widget build(BuildContext context) {
    final desc = product.description.trim();

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            textDirection: TextDirection.rtl,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: 120,
                  height: 120,
                  child: product.imageUrl.isEmpty
                      ? const ColoredBox(color: Color(0xFFF1F5F9))
                      : CachedNetworkImage(
                          imageUrl: product.imageUrl,
                          fit: BoxFit.cover,
                          placeholder: (_, __) =>
                              const ColoredBox(color: Color(0xFFF1F5F9)),
                          errorWidget: (_, __, ___) =>
                              const ColoredBox(color: Color(0xFFF1F5F9)),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      textAlign: TextAlign.right,
                      style: GoogleFonts.cairo(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF111827),
                        height: 1.25,
                      ),
                    ),
                    if (desc.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        desc,
                        textAlign: TextAlign.right,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.cairo(
                          fontSize: 13.5,
                          height: 1.45,
                          color: const Color(0xFF6B7280),
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),
                    Divider(height: 1, color: Colors.grey.shade100),
                    const SizedBox(height: 10),
                    if (_hasPrice)
                      Align(
                        alignment: Alignment.centerRight,
                        child: Text(
                          'يبدأ من ${product.customerListPrice.toStringAsFixed(2)} ₪',
                          style: GoogleFonts.cairo(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: _kProfessionalAccent,
                          ),
                        ),
                      )
                    else
                      Align(
                        alignment: Alignment.centerRight,
                        child: Text(
                          'السعر عند الطلب',
                          style: GoogleFonts.cairo(
                            fontSize: 13,
                            color: const Color(0xFF9CA3AF),
                          ),
                        ),
                      ),
                    const SizedBox(height: 10),
                    Wrap(
                      alignment: WrapAlignment.end,
                      spacing: 10,
                      runSpacing: 8,
                      textDirection: TextDirection.rtl,
                      children: [
                        TextButton(
                          onPressed: () => context.push(
                              '/market/$marketSlug/store/$storeId/product/${product.id}'),
                          child: Text(
                            'تفاصيل الخدمة',
                            style: GoogleFonts.cairo(
                              color: const Color(0xFF6B7280),
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: _kProfessionalAccent,
                            side: const BorderSide(
                                color: _kProfessionalAccent, width: 2),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10)),
                          ),
                          onPressed: () => _inquire(context),
                          icon: const Icon(Icons.message_rounded, size: 18),
                          label: Text(
                            'استفسر الآن',
                            style: GoogleFonts.cairo(
                                fontWeight: FontWeight.w700, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
