/// <reference types="vite/client" />

/** Native app (e.g. tenant portal in WebView) can expose push registration. */
declare global {
  interface Window {
    __NMD_NATIVE_REGISTER_PUSH__?: () => void;
  }
}
export {};
