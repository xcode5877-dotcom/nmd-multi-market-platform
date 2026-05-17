import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../../../api/storefront_api.dart';
import '../../../../design_system/design_system.dart';
import '../../../../widgets/nmd_text_field.dart';
import '../widgets/account_sub_scaffold.dart';

class AddressesPage extends StatefulWidget {
  const AddressesPage({super.key});

  @override
  State<AddressesPage> createState() => _AddressesPageState();
}

class _AddressesPageState extends State<AddressesPage> {
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final dio = context.read<Dio>();
    final list = await StorefrontApi(dio).getCustomerAddresses();
    if (!mounted) return;
    setState(() {
      _rows = list;
      _loading = false;
    });
  }

  Future<void> _openForm({Map<String, dynamic>? existing}) async {
    final labelCtrl =
        TextEditingController(text: '${existing?['label'] ?? ''}');
    final line1Ctrl =
        TextEditingController(text: '${existing?['line1'] ?? ''}');
    final cityCtrl = TextEditingController(text: '${existing?['city'] ?? ''}');
    final notesCtrl =
        TextEditingController(text: '${existing?['notes'] ?? ''}');
    var isDefault = existing?['isDefault'] == true;

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
                child: StatefulBuilder(
                  builder: (context, setModal) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          existing == null ? 'عنوان جديد' : 'تعديل العنوان',
                          textAlign: TextAlign.center,
                          style: NmdTypography.h3,
                        ),
                        const SizedBox(height: 16),
                        NmdTextField(
                          label: 'اسم مختصر (مثلاً: المنزل)',
                          controller: labelCtrl,
                          hint: 'اختياري',
                        ),
                        const SizedBox(height: 12),
                        NmdTextField(
                          label: 'العنوان بالتفصيل',
                          controller: line1Ctrl,
                          requiredField: true,
                        ),
                        const SizedBox(height: 12),
                        NmdTextField(
                          label: 'المدينة',
                          controller: cityCtrl,
                          requiredField: true,
                        ),
                        const SizedBox(height: 12),
                        NmdTextField(
                          label: 'ملاحظات',
                          controller: notesCtrl,
                          hint: 'اختياري',
                          maxLines: 2,
                        ),
                        const SizedBox(height: 8),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                            'العنوان الافتراضي',
                            style:
                                GoogleFonts.cairo(fontWeight: FontWeight.w600),
                          ),
                          value: isDefault,
                          activeThumbColor: NmdColors.brandPrimary,
                          activeTrackColor:
                              NmdColors.brandPrimary.withValues(alpha: 0.35),
                          onChanged: (v) => setModal(() => isDefault = v),
                        ),
                        const SizedBox(height: 16),
                        NmdButton(
                          label: 'حفظ',
                          onPressed: () async {
                            final messenger = ScaffoldMessenger.of(context);
                            final line1 = line1Ctrl.text.trim();
                            final city = cityCtrl.text.trim();
                            if (line1.isEmpty || city.isEmpty) {
                              messenger.showSnackBar(
                                const SnackBar(
                                    content: Text('العنوان والمدينة مطلوبان')),
                              );
                              return;
                            }
                            final dio = context.read<Dio>();
                            final api = StorefrontApi(dio);
                            final ok = existing == null
                                ? await api.postCustomerAddress(
                                    label: labelCtrl.text.trim().isEmpty
                                        ? null
                                        : labelCtrl.text.trim(),
                                    line1: line1,
                                    city: city,
                                    notes: notesCtrl.text.trim().isEmpty
                                        ? null
                                        : notesCtrl.text.trim(),
                                    isDefault: isDefault,
                                  )
                                : await api.patchCustomerAddress(
                                    '${existing['id']}',
                                    label: labelCtrl.text.trim().isEmpty
                                        ? null
                                        : labelCtrl.text.trim(),
                                    line1: line1,
                                    city: city,
                                    notes: notesCtrl.text.trim().isEmpty
                                        ? null
                                        : notesCtrl.text.trim(),
                                    isDefault: isDefault,
                                  );
                            if (!context.mounted) return;
                            if (ok != null) {
                              Navigator.pop(ctx);
                              await _load();
                              if (!context.mounted) return;
                              messenger.showSnackBar(
                                const SnackBar(content: Text('تم الحفظ')),
                              );
                            } else {
                              messenger.showSnackBar(
                                const SnackBar(content: Text('تعذر الحفظ')),
                              );
                            }
                          },
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        );
      },
    );
    labelCtrl.dispose();
    line1Ctrl.dispose();
    cityCtrl.dispose();
    notesCtrl.dispose();
  }

  Future<void> _confirmDelete(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          title: Text('حذف العنوان؟',
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
    final success = await StorefrontApi(dio).deleteCustomerAddress(id);
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
      title: 'العناوين',
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        backgroundColor: NmdColors.brandPrimary,
        foregroundColor: NmdColors.textOnBrand,
        icon: const Icon(Icons.add_rounded),
        label: Text(
          'عنوان جديد',
          style: NmdTypography.label.copyWith(
            color: NmdColors.textOnBrand,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: _loading
          ? const NmdLoading(message: 'جاري تحميل العناوين…')
          : _rows.isEmpty
              ? const NmdEmptyState(
                  title: 'لا توجد عناوين بعد',
                  message: 'احفظ عنوانك لتسهيل الطلبات القادمة',
                  icon: Icons.location_on_outlined,
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(NmdSpacing.screenHorizontal),
                  itemCount: _rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final a = _rows[i];
                    final id = '${a['id'] ?? ''}';
                    final label = '${a['label'] ?? ''}'.trim();
                    final line1 = '${a['line1'] ?? ''}';
                    final city = '${a['city'] ?? ''}';
                    final def = a['isDefault'] == true;
                    return NmdCard(
                      variant: NmdCardVariant.outlined,
                      padding: const EdgeInsets.symmetric(
                        horizontal: NmdSpacing.sm,
                        vertical: NmdSpacing.xxs,
                      ),
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                          label.isNotEmpty ? label : 'عنوان',
                          style: NmdTypography.label.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        subtitle: Text(
                          '$line1\n$city',
                          style: NmdTypography.bodySmall.copyWith(height: 1.35),
                        ),
                        isThreeLine: true,
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (def)
                              const Padding(
                                padding: EdgeInsets.only(left: 8),
                                child: NmdBadge(
                                  label: 'افتراضي',
                                  tone: NmdBadgeTone.brand,
                                  compact: true,
                                ),
                              ),
                            IconButton(
                              icon: const Icon(Icons.edit_outlined,
                                  color: NmdColors.brandPrimary),
                              onPressed: () => _openForm(existing: a),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline,
                                  color: NmdColors.error),
                              onPressed: () => _confirmDelete(id),
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
