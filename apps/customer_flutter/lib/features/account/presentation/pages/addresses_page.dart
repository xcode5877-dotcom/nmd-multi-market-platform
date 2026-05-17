import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../../../api/storefront_api.dart';
import '../../../../app/theme/app_colors.dart';
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
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.viewInsetsOf(ctx).bottom,
            ),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: StatefulBuilder(
                builder: (context, setModal) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        existing == null ? 'عنوان جديد' : 'تعديل العنوان',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.cairo(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
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
                          style: GoogleFonts.cairo(fontWeight: FontWeight.w600),
                        ),
                        value: isDefault,
                        activeThumbColor: AppColors.primaryTeal,
                        activeTrackColor:
                            AppColors.primaryTeal.withValues(alpha: 0.35),
                        onChanged: (v) => setModal(() => isDefault = v),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
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
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primaryTeal,
                          minimumSize: const Size.fromHeight(52),
                        ),
                        child: Text(
                          'حفظ',
                          style: GoogleFonts.cairo(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ],
                  );
                },
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
        backgroundColor: AppColors.primaryTeal,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: Text('عنوان جديد',
            style: GoogleFonts.cairo(fontWeight: FontWeight.w700)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primaryTeal))
          : _rows.isEmpty
              ? Center(
                  child: Text(
                    'لا توجد عناوين بعد.\nاضغط «عنوان جديد».',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.cairo(color: const Color(0xFF64748B)),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final a = _rows[i];
                    final id = '${a['id'] ?? ''}';
                    final label = '${a['label'] ?? ''}'.trim();
                    final line1 = '${a['line1'] ?? ''}';
                    final city = '${a['city'] ?? ''}';
                    final def = a['isDefault'] == true;
                    return Material(
                      elevation: 1,
                      shadowColor: Colors.black12,
                      borderRadius: BorderRadius.circular(14),
                      child: ListTile(
                        title: Text(
                          label.isNotEmpty ? label : 'عنوان',
                          style: GoogleFonts.cairo(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text(
                          '$line1\n$city',
                          style: GoogleFonts.cairo(height: 1.35),
                        ),
                        isThreeLine: true,
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (def)
                              Padding(
                                padding: const EdgeInsets.only(left: 8),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryTeal
                                        .withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    'افتراضي',
                                    style: GoogleFonts.cairo(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.primaryTeal,
                                    ),
                                  ),
                                ),
                              ),
                            IconButton(
                              icon: const Icon(Icons.edit_outlined,
                                  color: AppColors.primaryTeal),
                              onPressed: () => _openForm(existing: a),
                            ),
                            IconButton(
                              icon: Icon(Icons.delete_outline,
                                  color: Colors.red.shade400),
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
