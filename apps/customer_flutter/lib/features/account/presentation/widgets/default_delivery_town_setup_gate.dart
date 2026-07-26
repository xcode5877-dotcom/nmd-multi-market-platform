import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/customer_auth_launcher.dart';
import '../../../../design_system/design_system.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../application/customer_profile_cubit.dart';
import '../../data/delivery_town_repository.dart';
import 'delivery_town_picker_sheet.dart';

void _townsAudit(String message) {
  if (kDebugMode) {
    debugPrint('[TOWNS-AUDIT] $message');
  }
}

/// Routes where the blocking town-setup scrim must not cover shell content.
bool defaultTownOverlayAllowedForRoute(String path) {
  final segs = Uri.tryParse(path)?.pathSegments ?? [];
  if (segs.length < 3) return true;
  switch (segs[2]) {
    case 'account':
    case 'orders':
    case 'cart':
    case 'checkout':
      return false;
    default:
      return true;
  }
}

/// One-time blocking setup when a logged-in customer has no [defaultDeliveryTown].
class DefaultDeliveryTownSetupGate extends StatefulWidget {
  const DefaultDeliveryTownSetupGate({super.key, required this.child});

  final Widget child;

  @override
  State<DefaultDeliveryTownSetupGate> createState() =>
      _DefaultDeliveryTownSetupGateState();
}

class _DefaultDeliveryTownSetupGateState
    extends State<DefaultDeliveryTownSetupGate> {
  bool _checking = true;
  bool _needsSetup = false;
  bool _saving = false;
  bool _townsLoading = false;
  bool _townsLoadStarted = false;
  String? _error;
  String? _townsError;
  String? _selectedTown;
  List<String> _towns = const [];
  DeliveryTownRepository? _townRepository;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _evaluate());
  }

  DeliveryTownRepository _repository() {
    _townRepository ??= DeliveryTownRepository(context.read<Dio>());
    return _townRepository!;
  }

  Future<void> _evaluate() async {
    if (!mounted) return;
    _townsAudit('evaluate start loggedIn=${isCustomerLoggedIn(context)}');
    if (!isCustomerLoggedIn(context)) {
      if (mounted) {
        setState(() {
          _checking = false;
          _needsSetup = false;
          _townsLoading = false;
          _townsLoadStarted = false;
        });
      }
      _townsAudit('evaluate skip — guest');
      return;
    }

    final profileCubit = context.read<CustomerProfileCubit>();
    await profileCubit.refresh();
    if (!mounted) return;
    final defaultTown = profileCubit.state.primaryDeliveryArea;
    if (defaultTown.isNotEmpty) {
      setState(() {
        _checking = false;
        _needsSetup = false;
        _townsLoading = false;
        _townsLoadStarted = false;
      });
      _townsAudit('evaluate skip — default town already set');
      return;
    }

    setState(() {
      _checking = false;
      _needsSetup = true;
      _error = null;
      _townsError = null;
    });
    _townsAudit('evaluate needsSetup=true → load towns');
    await _loadTowns();
  }

  Future<void> _loadTowns({bool forceRefresh = false}) async {
    if (!mounted || !_needsSetup) return;
    if (!forceRefresh && _townsLoadStarted && _townsLoading) {
      _townsAudit('loadTowns skip — already in flight');
      return;
    }

    _townsLoadStarted = true;
    setState(() {
      _townsLoading = true;
      _townsError = null;
      _error = null;
    });
    _townsAudit('state transition → townsLoading=true');

    try {
      final towns = await _repository().fetchTowns(forceRefresh: forceRefresh);
      if (!mounted) return;
      setState(() {
        _townsLoading = false;
        _towns = towns;
        if (towns.isEmpty) {
          _townsError = 'لا توجد مناطق توصيل متاحة حالياً';
        }
        if (_selectedTown != null &&
            _selectedTown!.isNotEmpty &&
            !towns.contains(_selectedTown)) {
          _selectedTown = null;
        }
      });
      _townsAudit(
        'state transition → townsLoaded count=${towns.length} '
        'dropdownItems=${towns.length}',
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _townsLoading = false;
        _towns = const [];
        _townsError = 'تعذر تحميل مناطق التوصيل';
      });
      _townsAudit('state transition → townsError error=$error');
    }
  }

  Future<void> _openPicker() async {
    if (_townsLoading || _saving) return;
    if (_towns.isEmpty) {
      _townsAudit('openPicker towns empty → reload');
      await _loadTowns(forceRefresh: true);
    }
    if (!mounted || _towns.isEmpty) return;
    _townsAudit('openPicker dropdownItems=${_towns.length}');
    final picked = await showDeliveryTownPickerSheet(
      context,
      towns: _towns,
      selectedTown: _selectedTown,
    );
    if (picked != null && mounted) {
      setState(() {
        _selectedTown = picked;
        _error = null;
      });
      _townsAudit('openPicker selected=$picked');
    }
  }

  Future<void> _save() async {
    final town = _selectedTown?.trim() ?? '';
    if (town.isEmpty) {
      setState(() => _error = 'اختر منطقتك الرئيسية');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final profileCubit = context.read<CustomerProfileCubit>();
    var name = profileCubit.state.name?.trim() ?? '';
    if (name.isEmpty) {
      await profileCubit.refresh();
      if (!mounted) return;
      name = profileCubit.state.name?.trim() ?? '';
    }
    if (name.isEmpty) {
      setState(() {
        _saving = false;
        _error = 'تعذر تحميل الملف الشخصي';
      });
      return;
    }
    final ok = await profileCubit.savePrimaryDeliveryArea(
      town: town,
      name: name,
      source: 'profile',
    );
    if (!mounted) return;
    if (ok) {
      setState(() {
        _saving = false;
        _needsSetup = false;
      });
      _townsAudit('save success defaultDeliveryTown=$town');
    } else {
      setState(() {
        _saving = false;
        _error = 'تعذر الحفظ، حاول مرة أخرى';
      });
    }
  }

  Widget _townSelectorField() {
    if (_townsLoading) {
      return InputDecorator(
        decoration: InputDecoration(
          labelText: 'المنطقة الرئيسية',
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          suffixIcon: const SizedBox(
            width: 24,
            height: 24,
            child: Padding(
              padding: EdgeInsets.all(12),
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
        child: Text(
          'جاري تحميل المناطق...',
          style: NmdTypography.body.copyWith(color: NmdColors.textSecondary),
        ),
      );
    }

    if (_townsError != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InputDecorator(
            decoration: InputDecoration(
              labelText: 'المنطقة الرئيسية',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              enabled: false,
            ),
            child: Text(
              _towns.isEmpty ? 'لا توجد مناطق' : 'اختر منطقة',
              style: NmdTypography.body.copyWith(
                color: NmdColors.textSecondary,
              ),
            ),
          ),
          const SizedBox(height: NmdSpacing.sm),
          Text(
            _townsError!,
            style: NmdTypography.bodySmall.copyWith(color: NmdColors.error),
          ),
          const SizedBox(height: NmdSpacing.xs),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: _saving ? null : () => _loadTowns(forceRefresh: true),
              child: const Text('إعادة المحاولة'),
            ),
          ),
        ],
      );
    }

    return InkWell(
      onTap: _saving ? null : _openPicker,
      borderRadius: BorderRadius.circular(12),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: 'المنطقة الرئيسية',
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          suffixIcon: const Icon(Icons.keyboard_arrow_down_rounded),
        ),
        child: Text(
          _selectedTown?.isNotEmpty == true ? _selectedTown! : 'اختر منطقة',
          style: NmdTypography.body.copyWith(
            color: _selectedTown?.isNotEmpty == true
                ? NmdColors.textPrimary
                : NmdColors.textSecondary,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    final overlayAllowed = defaultTownOverlayAllowedForRoute(path);

    return BlocListener<AuthBloc, AuthState>(
      listenWhen: (prev, curr) => prev.step != curr.step,
      listener: (_, state) {
        if (state.step == AuthStep.done) {
          _townsAudit('auth step done → re-evaluate');
          setState(() {
            _checking = true;
            _townsLoadStarted = false;
          });
          _evaluate();
        } else if (_needsSetup) {
          setState(() {
            _needsSetup = false;
            _checking = false;
            _townsLoading = false;
            _townsLoadStarted = false;
          });
        }
      },
      child: _buildBody(overlayAllowed),
    );
  }

  Widget _buildBody(bool overlayAllowed) {
    if (_checking || !_needsSetup || !overlayAllowed) {
      return widget.child;
    }

    final canContinue = !_saving &&
        !_townsLoading &&
        _townsError == null &&
        _towns.isNotEmpty &&
        _selectedTown?.trim().isNotEmpty == true;

    return Stack(
      children: [
        widget.child,
        Positioned.fill(
          child: ColoredBox(
            color: Colors.black.withValues(alpha: 0.45),
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(NmdSpacing.screenHorizontal),
                child: Material(
                  color: NmdColors.surfaceBase,
                  borderRadius: BorderRadius.circular(20),
                  elevation: 8,
                  child: Padding(
                    padding: const EdgeInsets.all(NmdSpacing.lg),
                    child: Directionality(
                      textDirection: TextDirection.rtl,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'اختر منطقتك الرئيسية',
                            textAlign: TextAlign.center,
                            style: NmdTypography.h2,
                          ),
                          const SizedBox(height: NmdSpacing.xs),
                          Text(
                            'سنستخدم هذه المنطقة تلقائيًا عند إتمام الطلب، ويمكنك تغييرها لاحقًا.',
                            textAlign: TextAlign.center,
                            style: NmdTypography.bodySmall.copyWith(
                              height: 1.45,
                            ),
                          ),
                          const SizedBox(height: NmdSpacing.md),
                          _townSelectorField(),
                          if (_error != null) ...[
                            const SizedBox(height: NmdSpacing.sm),
                            Text(
                              _error!,
                              style: NmdTypography.bodySmall.copyWith(
                                color: NmdColors.error,
                              ),
                            ),
                          ],
                          const SizedBox(height: NmdSpacing.md),
                          NmdButton(
                            label: 'متابعة',
                            loading: _saving,
                            onPressed: canContinue ? _save : null,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
