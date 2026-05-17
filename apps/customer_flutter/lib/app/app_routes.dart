/// Named route paths for the customer app (GoRouter).
abstract final class AppRoutes {
  static String editProfile(String marketSlug) =>
      '/market/$marketSlug/account/edit-profile';

  static String addresses(String marketSlug) =>
      '/market/$marketSlug/account/addresses';

  static String paymentMethods(String marketSlug) =>
      '/market/$marketSlug/account/payment-methods';

  static String notificationSettings(String marketSlug) =>
      '/market/$marketSlug/account/notification-settings';

  static String help(String marketSlug) => '/market/$marketSlug/account/help';
}
