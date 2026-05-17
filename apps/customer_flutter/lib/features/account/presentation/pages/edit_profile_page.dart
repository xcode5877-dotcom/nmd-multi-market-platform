import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../../../api/storefront_api.dart';
import '../../../../app/theme/app_colors.dart';
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
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: DraggableScrollableSheet(
            expand: false,
            initialChildSize: 0.55,
            minChildSize: 0.35,
            maxChildSize: 0.92,
            builder: (context, scrollController) {
              return Column(
                children: [
                  const SizedBox(height: 10),
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                    child: Text(
                      'اختر المدينة',
                      style: GoogleFonts.cairo(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const Divider(height: 1),
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
                            style: GoogleFonts.cairo(
                              fontWeight:
                                  selected ? FontWeight.w700 : FontWeight.w500,
                              color: selected
                                  ? AppColors.primaryTeal
                                  : AppColors.textPrimary,
                            ),
                          ),
                          trailing: selected
                              ? const Icon(Icons.check,
                                  color: AppColors.primaryTeal)
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
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primaryTeal),
        ),
      );
    }

    return AccountSubScaffold(
      title: 'الملف الشخصي',
      bottomNavigationBar: _SaveGradientBar(
        onPressed: _saving ? null : _save,
        loading: _saving,
        bottomInset: bottomInset,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
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
                    style: GoogleFonts.cairo(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
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
            border: Border.all(color: const Color(0xFFE2E8F0), width: 2),
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
            color: AppColors.primaryTeal,
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
      color: const Color(0xFFF1F5F9),
      child: Center(
        child: Icon(
          Icons.person_rounded,
          size: 56,
          color: AppColors.primaryTeal.withValues(alpha: 0.65),
        ),
      ),
    );
  }
}

class _SaveGradientBar extends StatelessWidget {
  const _SaveGradientBar({
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
      color: Colors.white,
      elevation: 8,
      shadowColor: Colors.black26,
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + bottomInset),
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: <Color>[
                Color(0xFF0F766E),
                Color(0xFF14B8A6),
              ],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
            borderRadius: BorderRadius.circular(999),
            boxShadow: [
              BoxShadow(
                color: AppColors.primaryTeal.withValues(alpha: 0.35),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onPressed,
              borderRadius: BorderRadius.circular(999),
              child: SizedBox(
                height: 52,
                child: Center(
                  child: loading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          'حفظ التغييرات',
                          style: GoogleFonts.cairo(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
