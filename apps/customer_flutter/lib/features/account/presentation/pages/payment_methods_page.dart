import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../../../api/storefront_api.dart';
import '../../../../design_system/design_system.dart';
import '../../../../widgets/nmd_text_field.dart';
import '../../utils/card_validation.dart';
import '../widgets/account_sub_scaffold.dart';

class PaymentMethodsPage extends StatefulWidget {
  const PaymentMethodsPage({super.key});

  @override
  State<PaymentMethodsPage> createState() => _PaymentMethodsPageState();
}

class _PaymentMethodsPageState extends State<PaymentMethodsPage> {
  List<Map<String, dynamic>> _cards = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final dio = context.read<Dio>();
    final list = await StorefrontApi(dio).getCustomerPaymentMethods();
    if (!mounted) return;
    setState(() {
      _cards = list;
      _loading = false;
    });
  }

  Future<void> _openAddCard() async {
    final panCtrl = TextEditingController();
    final holderCtrl = TextEditingController();
    final monthCtrl = TextEditingController();
    final yearCtrl = TextEditingController();
    final cvvCtrl = TextEditingController();

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.viewInsetsOf(ctx).bottom,
            ),
            child: Container(
              decoration: const BoxDecoration(
                color: NmdColors.surfaceBase,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  NmdSpacing.screenHorizontal,
                  NmdSpacing.md,
                  NmdSpacing.screenHorizontal,
                  NmdSpacing.xl,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('إضافة بطاقة',
                        textAlign: TextAlign.center, style: NmdTypography.h3),
                    const SizedBox(height: NmdSpacing.xs),
                    Text(
                      'لا نخزن رقم البطاقة كاملاً — يُحفظ آخر 4 أرقام فقط.',
                      textAlign: TextAlign.center,
                      style: NmdTypography.bodySmall,
                    ),
                    const SizedBox(height: 16),
                    NmdTextField(
                      label: 'رقم البطاقة',
                      controller: panCtrl,
                      keyboardType: TextInputType.number,
                      requiredField: true,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(19),
                      ],
                    ),
                    const SizedBox(height: 12),
                    NmdTextField(
                      label: 'اسم حامل البطاقة',
                      controller: holderCtrl,
                      requiredField: true,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: NmdTextField(
                            label: 'الشهر',
                            controller: monthCtrl,
                            hint: 'MM',
                            keyboardType: TextInputType.number,
                            requiredField: true,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(2),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: NmdTextField(
                            label: 'السنة',
                            controller: yearCtrl,
                            hint: 'YY أو YYYY',
                            keyboardType: TextInputType.number,
                            requiredField: true,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(4),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    NmdTextField(
                      label: 'CVV',
                      controller: cvvCtrl,
                      keyboardType: TextInputType.number,
                      obscureText: true,
                      requiredField: true,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(4),
                      ],
                    ),
                    const SizedBox(height: 20),
                    NmdButton(
                      label: 'حفظ البطاقة',
                      onPressed: () async {
                        final messenger = ScaffoldMessenger.of(context);
                        final pan = panCtrl.text.trim();
                        final holder = holderCtrl.text.trim();
                        final m = int.tryParse(monthCtrl.text.trim());
                        var y = int.tryParse(yearCtrl.text.trim());
                        final cvv = cvvCtrl.text.trim();
                        if (holder.isEmpty || pan.isEmpty) {
                          messenger.showSnackBar(
                            const SnackBar(
                                content: Text('أكمل الحقول المطلوبة')),
                          );
                          return;
                        }
                        if (!luhnCheck(pan)) {
                          messenger.showSnackBar(
                            const SnackBar(
                                content: Text('رقم البطاقة غير صالح')),
                          );
                          return;
                        }
                        if (m == null || m < 1 || m > 12) {
                          messenger.showSnackBar(
                            const SnackBar(content: Text('الشهر غير صالح')),
                          );
                          return;
                        }
                        if (y == null) {
                          messenger.showSnackBar(
                            const SnackBar(content: Text('السنة غير صالحة')),
                          );
                          return;
                        }
                        if (y < 100) y += 2000;
                        final need = expectedCvvLength(pan);
                        if (cvv.length != need) {
                          messenger.showSnackBar(
                            SnackBar(
                                content: Text('CVV يجب أن يكون $need أرقام')),
                          );
                          return;
                        }
                        final end = DateTime(y, m + 1, 0, 23, 59, 59);
                        if (end.isBefore(DateTime.now())) {
                          messenger.showSnackBar(
                            const SnackBar(content: Text('البطاقة منتهية')),
                          );
                          return;
                        }
                        final dio = context.read<Dio>();
                        final res =
                            await StorefrontApi(dio).postCustomerPaymentMethod(
                          cardNumber: pan,
                          holderName: holder,
                          expiryMonth: m,
                          expiryYear: y,
                          cvv: cvv,
                        );
                        if (!context.mounted) return;
                        if (res != null) {
                          Navigator.pop(ctx);
                          await _load();
                          if (!context.mounted) return;
                          messenger.showSnackBar(
                            const SnackBar(content: Text('تمت إضافة البطاقة')),
                          );
                        } else {
                          messenger.showSnackBar(
                            const SnackBar(content: Text('تعذر الحفظ')),
                          );
                        }
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
    panCtrl.dispose();
    holderCtrl.dispose();
    monthCtrl.dispose();
    yearCtrl.dispose();
    cvvCtrl.dispose();
  }

  Future<void> _delete(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          title: Text('حذف البطاقة؟',
              style: GoogleFonts.cairo(fontWeight: FontWeight.w700)),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text('إلغاء', style: GoogleFonts.cairo()),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text('حذف', style: GoogleFonts.cairo(color: Colors.red)),
            ),
          ],
        ),
      ),
    );
    if (ok != true || !mounted) return;
    final dio = context.read<Dio>();
    final success = await StorefrontApi(dio).deleteCustomerPaymentMethod(id);
    if (!mounted) return;
    if (success) {
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم الحذف')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تعذر الحذف')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AccountSubScaffold(
      title: 'طرق الدفع',
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAddCard,
        backgroundColor: NmdColors.brandPrimary,
        foregroundColor: NmdColors.textOnBrand,
        icon: const Icon(Icons.add_card_outlined),
        label: Text(
          'إضافة بطاقة',
          style: NmdTypography.label.copyWith(
            color: NmdColors.textOnBrand,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: _loading
          ? const NmdLoading(message: 'جاري تحميل البطاقات…')
          : _cards.isEmpty
              ? const NmdEmptyState(
                  title: 'لا توجد بطاقات محفوظة',
                  message: 'أضف بطاقة لتسريع الدفع — نحفظ آخر 4 أرقام فقط',
                  icon: Icons.credit_card_outlined,
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(NmdSpacing.screenHorizontal),
                  itemCount: _cards.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 14),
                  itemBuilder: (context, i) {
                    final c = _cards[i];
                    final id = '${c['id'] ?? ''}';
                    final brand = '${c['brand'] ?? 'Card'}';
                    final last4 = '${c['last4'] ?? ''}';
                    final holder = '${c['holderName'] ?? ''}';
                    final em = c['expiryMonth'];
                    final ey = c['expiryYear'];
                    final mm = em is int
                        ? em.toString().padLeft(2, '0')
                        : '$em'.padLeft(2, '0');
                    var yDisp = ey is int ? ey : int.tryParse('$ey') ?? 0;
                    if (yDisp > 99) yDisp = yDisp % 100;
                    return Container(
                      decoration: BoxDecoration(
                        borderRadius: NmdRadius.borderMd,
                        gradient: const LinearGradient(
                          colors: [NmdColors.brandPrimary, NmdColors.brandDeep],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: NmdShadows.brandGlow(alpha: 0.3),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  brand,
                                  style: GoogleFonts.cairo(
                                    color: Colors.white70,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                                const Spacer(),
                                IconButton(
                                  onPressed: () => _delete(id),
                                  icon: const Icon(Icons.delete_outline,
                                      color: Colors.white70),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              '•••• •••• •••• $last4',
                              style: GoogleFonts.cairo(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.2,
                              ),
                            ),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'الاسم',
                                      style: GoogleFonts.cairo(
                                          color: Colors.white54, fontSize: 11),
                                    ),
                                    Text(
                                      holder,
                                      style: GoogleFonts.cairo(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                                const Spacer(),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      'انتهاء',
                                      style: GoogleFonts.cairo(
                                          color: Colors.white54, fontSize: 11),
                                    ),
                                    Text(
                                      '$mm/${yDisp.toString().padLeft(2, '0')}',
                                      style: GoogleFonts.cairo(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
