import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../../../api/storefront_api.dart';
import '../../../../design_system/design_system.dart';
import '../../../../core/support/open_support_whatsapp.dart';
import '../../../../widgets/nmd_text_field.dart';
import '../../data/profile_cities.dart';
import '../widgets/account_sub_scaffold.dart';

class EditProfilePage extends StatefulWidget {
  const EditProfilePage({super.key});

  @override
  State<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends State<EditProfilePage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _cityCtrl;

  String? _avatarUrl;
  String? _selectedCity;

  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController();
    _emailCtrl = TextEditingController();
    _phoneCtrl = TextEditingController();
    _cityCtrl = TextEditingController();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadProfile());
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _cityCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    final dio = context.read<Dio>();
    final me = await StorefrontApi(dio).getCustomerMe();
    if (!mounted) return;
    if (me == null) {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تعذر تحميل الملف الشخصي')),
      );
      return;
    }
    setState(() {
      _nameCtrl.text = '${me['name'] ?? ''}'.trim();
      _emailCtrl.text = '${me['email'] ?? ''}'.trim();
      _phoneCtrl.text = '${me['phone'] ?? ''}'.trim();
      _selectedCity = me['city'] as String?;
      if (_selectedCity != null && _selectedCity!.isNotEmpty) {
        _cityCtrl.text = _selectedCity!;
      }
      final raw = me['avatarUrl'];
      _avatarUrl = raw is String && raw.trim().isNotEmpty ? raw.trim() : null;
      _loading = false;
    });
  }

  String? _validateName(String? v) {
    if (v == null || v.trim().isEmpty) return 'الاسم مطلوب';
    return null;
  }

  String? _validateEmail(String? v) {
    final t = v?.trim() ?? '';
    if (t.isEmpty) return null;
    final ok = RegExp(r'^[^@\s]+@([^\s@]+\.)+[^\s@]+$').hasMatch(t);
    return ok ? null : 'صيغة البريد غير صحيحة';
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    final dio = context.read<Dio>();
    final res = await StorefrontApi(dio).patchCustomerProfile(
      name: _nameCtrl.text,
      email: _emailCtrl.text.trim(),
      city: _selectedCity?.trim() ?? '',
      avatarUrl: _avatarUrl,
    );
    if (!mounted) return;
    setState(() => _saving = false);
    final messenger = ScaffoldMessenger.of(context);
    if (res != null) {
      messenger.showSnackBar(
        const SnackBar(content: Text('تم حفظ التغييرات')),
      );
    } else {
      messenger.showSnackBar(
        const SnackBar(content: Text('تعذر الحفظ، حاول لاحقاً')),
      );
    }
  }

  void _onAvatarEditTap() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('قريباً: تغيير الصورة')),
    );
  }

  void _openCityPicker() {
    FocusScope.of(context).unfocus();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: NmdColors.surfaceBase,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.55,
              minChildSize: 0.35,
              maxChildSize: 0.92,
              builder: (context, scrollController) {
                return Column(
                  children: [
                    const SizedBox(height: NmdSpacing.sm),
                    Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: NmdColors.borderSubtle,
                        borderRadius: NmdRadius.borderPill,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        NmdSpacing.screenHorizontal,
                        NmdSpacing.md,
                        NmdSpacing.screenHorizontal,
                        NmdSpacing.xs,
                      ),
                      child: Text('اختر المدينة', style: NmdTypography.h3),
                    ),
                    const Divider(height: 1, color: NmdColors.borderSubtle),
                    Expanded(
                      child: ListView.builder(
                        controller: scrollController,
                        itemCount: kNmdProfileCities.length,
                        itemBuilder: (context, i) {
                          final city = kNmdProfileCities[i];
                          final selected = _selectedCity == city;
                          return ListTile(
                            title: Text(
                              city,
                              style: NmdTypography.label.copyWith(
                                fontWeight: selected
                                    ? FontWeight.w800
                                    : FontWeight.w600,
                                color: selected
                                    ? NmdColors.brandPrimary
                                    : NmdColors.textPrimary,
                              ),
                            ),
                            trailing: selected
                                ? const Icon(Icons.check_rounded,
                                    color: NmdColors.brandPrimary)
                                : null,
                            onTap: () {
                              setState(() {
                                _selectedCity = city;
                                _cityCtrl.text = city;
                              });
                              Navigator.of(context).pop();
                            },
                          );
                        },
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        );
      },
    );
  }

  Future<void> _confirmDeleteAccount() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            title: Text('حذف الحساب',
                style: GoogleFonts.cairo(fontWeight: FontWeight.w700)),
            content: Text(
              'سيتم التواصل مع الدعم لإتمام الحذف. المتابعة؟',
              style: GoogleFonts.cairo(),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text('إلغاء',
                    style: GoogleFonts.cairo(color: const Color(0xFF64748B))),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text('متابعة',
                    style: GoogleFonts.cairo(color: Colors.red.shade700)),
              ),
            ],
          ),
        );
      },
    );
    if (ok == true && mounted) {
      await launchNmdSupportWhatsApp(
        messenger: ScaffoldMessenger.maybeOf(context),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم إرسال طلب حذف الحساب إلى الدعم.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    if (_loading) {
      return const AccountSubScaffold(
        title: 'الملف الشخصي',
        body: NmdLoading(message: 'جاري تحميل الملف…'),
      );
    }

    return AccountSubScaffold(
      title: 'الملف الشخصي',
      bottomNavigationBar: _SaveBar(
        onPressed: _saving ? null : _save,
        loading: _saving,
        bottomInset: bottomInset,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          NmdSpacing.screenHorizontal,
          NmdSpacing.xs,
          NmdSpacing.screenHorizontal,
          NmdSpacing.xl,
        ),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: _AvatarHeader(
                  imageUrl: _avatarUrl,
                  onEditTap: _onAvatarEditTap,
                ),
              ),
              const SizedBox(height: 28),
              NmdTextField(
                label: 'الاسم الكامل',
                controller: _nameCtrl,
                requiredField: true,
                validator: _validateName,
              ),
              const SizedBox(height: 14),
              NmdTextField(
                label: 'رقم الجوال',
                controller: _phoneCtrl,
                readOnly: true,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 14),
              NmdTextField(
                label: 'البريد الإلكتروني',
                controller: _emailCtrl,
                hint: 'اختياري',
                keyboardType: TextInputType.emailAddress,
                validator: _validateEmail,
              ),
              const SizedBox(height: 14),
              NmdTextField(
                label: 'المدينة',
                controller: _cityCtrl,
                hint: 'اختر المدينة',
                readOnly: true,
                onTap: _openCityPicker,
                suffixIcon: const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 32),
              Center(
                child: TextButton(
                  onPressed: _confirmDeleteAccount,
                  style: TextButton.styleFrom(
                    foregroundColor:
                        Colors.red.shade400.withValues(alpha: 0.88),
                  ),
                  child: Text(
                    'حذف الحساب',
                    style: NmdTypography.bodySmall.copyWith(
                      color: NmdColors.error.withValues(alpha: 0.88),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}

class _AvatarHeader extends StatelessWidget {
  const _AvatarHeader({
    required this.imageUrl,
    required this.onEditTap,
  });

  final String? imageUrl;
  final VoidCallback onEditTap;

  @override
  Widget build(BuildContext context) {
    const double size = 120;

    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: NmdColors.borderSubtle, width: 2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: ClipOval(
            child: imageUrl != null && imageUrl!.isNotEmpty
                ? Image.network(
                    imageUrl!,
                    fit: BoxFit.cover,
                    width: size,
                    height: size,
                    errorBuilder: (_, __, ___) => const _AvatarFallback(),
                  )
                : const _AvatarFallback(),
          ),
        ),
        PositionedDirectional(
          bottom: 2,
          end: 2,
          child: Material(
            color: NmdColors.brandPrimary,
            shape: const CircleBorder(),
            elevation: 2,
            child: InkWell(
              onTap: onEditTap,
              customBorder: const CircleBorder(),
              child: const Padding(
                padding: EdgeInsets.all(8),
                child: Icon(
                  Icons.edit_outlined,
                  size: 18,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _AvatarFallback extends StatelessWidget {
  const _AvatarFallback();

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: NmdColors.surfaceMuted,
      child: Center(
        child: Icon(
          Icons.person_rounded,
          size: 56,
          color: NmdColors.brandPrimary.withValues(alpha: 0.65),
        ),
      ),
    );
  }
}

class _SaveBar extends StatelessWidget {
  const _SaveBar({
    required this.onPressed,
    required this.loading,
    required this.bottomInset,
  });

  final VoidCallback? onPressed;
  final bool loading;
  final double bottomInset;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NmdColors.surfaceBase,
      elevation: 8,
      shadowColor: Colors.black26,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          NmdSpacing.screenHorizontal,
          NmdSpacing.sm,
          NmdSpacing.screenHorizontal,
          NmdSpacing.sm + bottomInset,
        ),
        child: NmdButton(
          label: 'حفظ التغييرات',
          loading: loading,
          onPressed: onPressed,
        ),
      ),
    );
  }
}
