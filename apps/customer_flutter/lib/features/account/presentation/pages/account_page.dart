import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../app/app_routes.dart';
import '../../../../core/auth/ensure_customer_auth.dart';
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

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthBloc>().state;
    final coins = context.watch<CoinsBalanceCubit>().state;
    final loggedIn = auth.step == AuthStep.done;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      children: [
        if (loggedIn)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Material(
              color: const Color(0xFF0F766E),
              borderRadius: BorderRadius.circular(14),
              child: ListTile(
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                title: Text(
                  'رصيد عملات NMD',
                  style: GoogleFonts.cairo(
                    color: Colors.white70,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                subtitle: coins.loading
                    ? const Padding(
                        padding: EdgeInsets.only(top: 6),
                        child: SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        ),
                      )
                    : Text(
                        '${coins.balance ?? 0} عملة',
                        style: GoogleFonts.cairo(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 22,
                        ),
                      ),
                trailing: IconButton(
                  icon: const Icon(Icons.refresh, color: Colors.white),
                  onPressed: () => context.read<CoinsBalanceCubit>().refresh(),
                ),
              ),
            ),
          ),
        _AccountTile(
          title: 'الملف الشخصي',
          icon: Icons.person_outline,
          onTap: () => _openAfterAuth(
            context,
            (slug) async => context.push(AppRoutes.editProfile(slug)),
          ),
        ),
        _AccountTile(
          title: 'العناوين',
          icon: Icons.location_on_outlined,
          onTap: () => _openAfterAuth(
            context,
            (slug) async => context.push(AppRoutes.addresses(slug)),
          ),
        ),
        _AccountTile(
          title: 'طرق الدفع',
          icon: Icons.credit_card_outlined,
          onTap: () => _openAfterAuth(
            context,
            (slug) async => context.push(AppRoutes.paymentMethods(slug)),
          ),
        ),
        _AccountTile(
          title: 'الإشعارات',
          icon: Icons.notifications_none,
          onTap: () => _openAfterAuth(
            context,
            (slug) async => context.push(AppRoutes.notificationSettings(slug)),
          ),
        ),
        _AccountTile(
          title: 'المساعدة والدعم',
          icon: Icons.help_outline,
          onTap: () => _openAfterAuth(
            context,
            (slug) async => context.push(AppRoutes.help(slug)),
          ),
        ),
      ],
    );
  }
}

class _AccountTile extends StatelessWidget {
  const _AccountTile({
    required this.title,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cardColor = Theme.of(context).cardColor;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: cardColor,
        elevation: 1,
        shadowColor: Colors.black.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ListTile(
            leading: Icon(icon, color: const Color(0xFF0F766E)),
            title: Text(title),
            trailing: const Icon(Icons.chevron_right),
          ),
        ),
      ),
    );
  }
}
