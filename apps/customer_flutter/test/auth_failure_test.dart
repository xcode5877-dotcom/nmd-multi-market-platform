import 'package:customer_flutter/core/auth/auth_failure.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('classifyEndpointAuth', () {
    test('public catalog routes', () {
      expect(
        classifyEndpointAuth('/markets/by-slug/dabburiyya/feed-campaigns'),
        EndpointAuthMode.public,
      );
      expect(
        classifyEndpointAuth('/markets/by-slug/x/banners'),
        EndpointAuthMode.public,
      );
      expect(classifyEndpointAuth('/tenants'), EndpointAuthMode.public);
      expect(classifyEndpointAuth('/catalog/tenant-1'), EndpointAuthMode.public);
    });

    test('optional GET /rewards', () {
      expect(
        classifyEndpointAuth('/rewards', method: 'GET'),
        EndpointAuthMode.optionalAuth,
      );
    });

    test('protected customer routes', () {
      expect(
        classifyEndpointAuth('/customer/orders'),
        EndpointAuthMode.protected,
      );
      expect(
        classifyEndpointAuth('/customer/rewards/abc/redeem', method: 'POST'),
        EndpointAuthMode.protected,
      );
    });
  });

  group('isPublicBrowseEndpoint', () {
    test('listed home browse paths', () {
      expect(
        isPublicBrowseEndpoint('/markets/by-slug/dabburiyya/feed-campaigns'),
        isTrue,
      );
      expect(
        isPublicBrowseEndpoint('/markets/by-slug/dabburiyya/layout'),
        isTrue,
      );
      expect(
        isPublicBrowseEndpoint('/markets/by-slug/dabburiyya'),
        isTrue,
      );
      expect(isPublicBrowseEndpoint('/rewards'), isTrue);
      expect(isPublicBrowseEndpoint('/catalog/abc'), isTrue);
    });

    test('protected paths are not public browse', () {
      expect(isPublicBrowseEndpoint('/customer/me'), isFalse);
      expect(isPublicBrowseEndpoint('/customer/coins'), isFalse);
    });
  });

  group('shouldForceLogout', () {
    test('protected + hadToken → true', () {
      expect(
        shouldForceLogout(
          path: '/customer/coins',
          hadToken: true,
          statusCode: 401,
        ),
        isTrue,
      );
    });

    test('public browse + hadToken → false', () {
      expect(
        shouldForceLogout(
          path: '/markets/by-slug/x/feed-campaigns',
          hadToken: true,
          statusCode: 401,
        ),
        isFalse,
      );
    });

    test('protected without token → false', () {
      expect(
        shouldForceLogout(
          path: '/customer/orders',
          hadToken: false,
          statusCode: 401,
        ),
        isFalse,
      );
    });
  });

  group('classifyAuthFailure', () {
    test('protected without token → login required', () {
      expect(
        classifyAuthFailure(
          path: '/customer/orders',
          hadToken: false,
          statusCode: 401,
        ),
        AuthFailureKind.loginRequired,
      );
    });

    test('protected with token → session expired', () {
      expect(
        classifyAuthFailure(
          path: '/customer/me',
          hadToken: true,
          statusCode: 401,
        ),
        AuthFailureKind.sessionExpired,
      );
    });

    test('optional GET /rewards 401 → none', () {
      expect(
        classifyAuthFailure(
          path: '/rewards',
          hadToken: true,
          statusCode: 401,
          method: 'GET',
        ),
        AuthFailureKind.none,
      );
    });

    test('feed-campaigns 401 → none even with token', () {
      expect(
        classifyAuthFailure(
          path: '/markets/by-slug/x/feed-campaigns',
          hadToken: true,
          statusCode: 401,
        ),
        AuthFailureKind.none,
      );
    });
  });

  group('shouldAttachCustomerToken', () {
    test('never attaches on public browse', () {
      expect(
        shouldAttachCustomerToken('/markets/by-slug/x/feed-campaigns'),
        isFalse,
      );
      expect(shouldAttachCustomerToken('/catalog/t1'), isFalse);
    });
  });
}
