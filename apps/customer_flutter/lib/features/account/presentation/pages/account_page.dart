import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/app_routes.dart';
import '../../../../core/auth/customer_logout.dart';
import '../../../../core/auth/ensure_customer_auth.dart';
import '../../../../design_system/design_system.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../loyalty/application/coins_balance_cubit.dart';

class AccountPage extends StatelessWidget {
  const AccountPage({super.key});

  Future<void> _openAfterAuth(
    BuildContext context,
    Future<void> Function(String slug) navigate,
  ) async {
    final ok = await ensureCustomerAuth(context);
    if (!context.mounted || !ok) return;
    final slug = GoRouterState.of(context).pathParameters['slug'] ?? '';
    if (slug.isEmpty) return;
    await navigate(slug);
  }

  Future<void> _signIn(BuildContext context) async {
    if (kDebugMode) {
      debugPrint('[AUTH-AUDIT] account login button tap');
    }
    await ensureCustomerAuth(context);
    if (!context.mounted) return;
    context.read<CoinsBalanceCubit>().refresh();
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          title: Text(
            'تسجيل الخروج',
            style: NmdTypography.h3,
          ),
          content: Text(
            'هل أنت متأكد أنك تريد تسجيل الخروج؟',
            style: NmdTypography.body,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(
                'إلغاء',
                style: NmdTypography.label.copyWith(
                  color: NmdColors.textSecondary,
                ),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(
                'تسجيل الخروج',
                style: NmdTypography.label.copyWith(
                  color: NmdColors.error,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true || !context.mounted) return;

    await performCustomerLogout(context);
    if (!context.mounted) return;

    final slug = GoRouterState.of(context).pathParameters['slug'] ?? '';
    if (slug.isEmpty) return;
    context.go('/market/$slug');
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthBloc>().state;
    final coins = context.watch<CoinsBalanceCubit>().state;
    final loggedIn = auth.step == AuthStep.done;
    final slug = GoRouterState.of(context).pathParameters['slug'] ?? '';

    return ColoredBox(
      color: NmdColors.surfaceMuted,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          NmdSpacing.screenHorizontal,
          NmdSpacing.sm,
          NmdSpacing.screenHorizontal,
          NmdSpacing.xxl,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
          NmdSectionHeader(
            title: 'حسابي',
            subtitle: loggedIn
                ? 'مركز هويتك في Now Market'
                : 'سجّل دخولك للوصول إلى إعداداتك',
            padding: EdgeInsets.zero,
          ),
          const SizedBox(height: NmdSpacing.sm),
          _IdentityHeader(
            loggedIn: loggedIn,
            phone: auth.phone,
            onSignIn: () => _signIn(context),
          ),
          if (loggedIn) ...[
            const SizedBox(height: NmdSpacing.md),
            _CoinsCard(
              balance: coins.balance,
              loading: coins.loading,
              onRefresh: () => context.read<CoinsBalanceCubit>().refresh(),
              onRewards: slug.isNotEmpty
                  ? () => context.go('/market/$slug/rewards')
                  : null,
            ),
            const SizedBox(height: NmdSpacing.md),
            _QuickActionsRow(
              onProfile: () => _openAfterAuth(
                context,
                (s) async => context.push(AppRoutes.editProfile(s)),
              ),
              onAddresses: () => _openAfterAuth(
                context,
                (s) async => context.push(AppRoutes.addresses(s)),
              ),
            ),
          ],
          const SizedBox(height: NmdSpacing.lg),
          NmdSectionHeader(
            title: 'الإعدادات',
            padding: const EdgeInsetsDirectional.only(bottom: NmdSpacing.sm),
          ),
          _AccountTile(
            title: 'الملف الشخصي',
            subtitle: 'الاسم والبريد والمدينة',
            icon: Icons.person_outline_rounded,
            onTap: () => _openAfterAuth(
              context,
              (s) async => context.push(AppRoutes.editProfile(s)),
            ),
          ),
          _AccountTile(
            title: 'العناوين',
            subtitle: 'عناوين التوصيل المحفوظة',
            icon: Icons.location_on_outlined,
            onTap: () => _openAfterAuth(
              context,
              (s) async => context.push(AppRoutes.addresses(s)),
            ),
          ),
          _AccountTile(
            title: 'طرق الدفع',
            subtitle: 'البطاقات المحفوظة بأمان',
            icon: Icons.credit_card_outlined,
            onTap: () => _openAfterAuth(
              context,
              (s) async => context.push(AppRoutes.paymentMethods(s)),
            ),
          ),
          _AccountTile(
            title: 'الإشعارات',
            subtitle: 'تحديثات الطلبات والعروض',
            icon: Icons.notifications_none_rounded,
            onTap: () => _openAfterAuth(
              context,
              (s) async => context.push(AppRoutes.notificationSettings(s)),
            ),
          ),
          const SizedBox(height: NmdSpacing.lg),
          NmdSectionHeader(
            title: 'الثقة والدعم',
            padding: const EdgeInsetsDirectional.only(bottom: NmdSpacing.sm),
          ),
          _AccountTile(
            title: 'مركز الدعم',
            subtitle: 'واتساب، اتصال هاتفي، والأسئلة الشائعة',
            icon: Icons.support_agent_rounded,
            onTap: () => _openAfterAuth(
              context,
              (s) async => context.push(AppRoutes.help(s)),
            ),
          ),
          if (!loggedIn) ...[
            const SizedBox(height: NmdSpacing.md),
            NmdButton(
              key: const Key('account_login_button'),
              label: 'تسجيل الدخول',
              onPressed: () => _signIn(context),
            ),
          ],
          if (loggedIn) ...[
            const SizedBox(height: NmdSpacing.xl),
            _LogoutButton(onPressed: () => _confirmLogout(context)),
          ],
          ],
        ),
      ),
    );
  }
}

class _LogoutButton extends StatelessWidget {
  const _LogoutButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      key: const Key('account_logout_button'),
      onPressed: onPressed,
      icon: const Icon(Icons.logout_rounded, size: 20),
      label: Text(
        'تسجيل الخروج',
        style: NmdTypography.bodyBold.copyWith(color: NmdColors.error),
      ),
      style: OutlinedButton.styleFrom(
        foregroundColor: NmdColors.error,
        side: const BorderSide(color: NmdColors.error, width: 1.4),
        minimumSize: const Size(double.infinity, 52),
        padding: const EdgeInsets.symmetric(
          horizontal: NmdSpacing.md,
          vertical: NmdSpacing.sm,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: NmdRadius.borderPill,
        ),
      ),
    );
  }
}

class _IdentityHeader extends StatelessWidget {
  const _IdentityHeader({
    required this.loggedIn,
    required this.phone,
    required this.onSignIn,
  });

  final bool loggedIn;
  final String phone;
  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    return NmdSurface(
      mode: NmdSurfaceMode.alive,
      padding: const EdgeInsets.all(NmdSpacing.md),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: NmdColors.brandPrimary,
              border: Border.all(
                color: NmdColors.brandSecondary.withValues(alpha: 0.5),
                width: 2,
              ),
              boxShadow: NmdShadows.brandGlow(alpha: 0.2),
            ),
            child: Icon(
              loggedIn ? Icons.person_rounded : Icons.person_outline_rounded,
              color: NmdColors.textOnBrand,
              size: 30,
            ),
          ),
          const SizedBox(width: NmdSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  loggedIn ? 'أهلاً بك' : 'مرحباً بك في Now Market',
                  style: NmdTypography.h3,
                ),
                const SizedBox(height: NmdSpacing.xxs),
                Text(
                  loggedIn && phone.isNotEmpty
                      ? phone
                      : 'سجّل دخولك برقم الجوال — سريع وآمن',
                  style: NmdTypography.bodySmall,
                ),
                if (loggedIn) ...[
                  const SizedBox(height: NmdSpacing.xs),
                  NmdBadge(
                    label: 'عضو Now Market',
                    tone: NmdBadgeTone.brand,
                    compact: true,
                  ),
                ],
              ],
            ),
          ),
          if (!loggedIn)
            NmdButton(
              key: const Key('account_login_compact_button'),
              label: 'دخول',
              size: NmdButtonSize.compact,
              expand: false,
              onPressed: onSignIn,
            ),
        ],
      ),
    );
  }
}

class _CoinsCard extends StatelessWidget {
  const _CoinsCard({
    required this.balance,
    required this.loading,
    required this.onRefresh,
    this.onRewards,
  });

  final int? balance;
  final bool loading;
  final VoidCallback onRefresh;
  final VoidCallback? onRewards;

  @override
  Widget build(BuildContext context) {
    return NmdCard(
      variant: NmdCardVariant.community,
      padding: const EdgeInsets.all(NmdSpacing.md),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: NmdColors.accentGold.withValues(alpha: 0.2),
            ),
            child: const Icon(
              Icons.monetization_on_outlined,
              color: NmdColors.accentGold,
            ),
          ),
          const SizedBox(width: NmdSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'رصيد عملات NMD',
                  style: NmdTypography.label.copyWith(
                    color: NmdColors.textOnDark.withValues(alpha: 0.75),
                  ),
                ),
                const SizedBox(height: NmdSpacing.xxs),
                loading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: NmdColors.accentGold,
                        ),
                      )
                    : Text(
                        '${balance ?? 0} عملة',
                        style: NmdTypography.h2.copyWith(
                          color: NmdColors.accentGold,
                        ),
                      ),
              ],
            ),
          ),
          IconButton(
            onPressed: onRefresh,
            icon: Icon(
              Icons.refresh_rounded,
              color: NmdColors.textOnDark.withValues(alpha: 0.85),
            ),
          ),
          if (onRewards != null)
            TextButton(
              onPressed: onRewards,
              child: Text(
                'المكافآت',
                style: NmdTypography.label.copyWith(
                  color: NmdColors.accentGold,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _QuickActionsRow extends StatelessWidget {
  const _QuickActionsRow({
    required this.onProfile,
    required this.onAddresses,
  });

  final VoidCallback onProfile;
  final VoidCallback onAddresses;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _QuickActionCard(
            icon: Icons.edit_outlined,
            label: 'الملف',
            onTap: onProfile,
          ),
        ),
        const SizedBox(width: NmdSpacing.sm),
        Expanded(
          child: _QuickActionCard(
            icon: Icons.home_work_outlined,
            label: 'العناوين',
            onTap: onAddresses,
          ),
        ),
      ],
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  const _QuickActionCard({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return NmdCard(
      variant: NmdCardVariant.outlined,
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
        vertical: NmdSpacing.md,
        horizontal: NmdSpacing.sm,
      ),
      child: Column(
        children: [
          Icon(icon, color: NmdColors.brandPrimary, size: 26),
          const SizedBox(height: NmdSpacing.xs),
          Text(
            label,
            style: NmdTypography.label.copyWith(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _AccountTile extends StatelessWidget {
  const _AccountTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: NmdSpacing.sm),
      child: NmdCard(
        variant: NmdCardVariant.outlined,
        onTap: onTap,
        padding: const EdgeInsets.symmetric(
          horizontal: NmdSpacing.md,
          vertical: NmdSpacing.sm,
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: NmdColors.tintAliveSoft,
                borderRadius: NmdRadius.borderSm,
              ),
              child: Icon(icon, color: NmdColors.brandPrimary, size: 22),
            ),
            const SizedBox(width: NmdSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: NmdTypography.label.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(subtitle, style: NmdTypography.bodySmall),
                ],
              ),
            ),
            Icon(
              Icons.chevron_left_rounded,
              color: NmdColors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }
}
