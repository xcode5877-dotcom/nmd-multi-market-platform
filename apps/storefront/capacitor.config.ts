import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Customer storefront — Capacitor iOS/Android shell.
 * iOS bundle ID: com.nowmarket.app (Android applicationId may differ until aligned).
 */
const config: CapacitorConfig = {
  appId: 'com.nowmarket.app',
  appName: 'Now Market',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#0f766e',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
