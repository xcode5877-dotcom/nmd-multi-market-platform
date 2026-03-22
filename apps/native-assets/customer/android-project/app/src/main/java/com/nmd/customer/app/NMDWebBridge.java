package com.nmd.customer.app;

import android.content.Context;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/**
 * JavaScript interface for Web ↔ Native communication.
 * Injected as "NMDNative" in the WebView. The web app can call:
 * - NMDNative.setBottomBarVisible(true|false) to show/hide the native bottom bar
 * - NMDNative.getToken() to get the current FCM device token (empty string if not yet available)
 * - NMDNative.setCustomerToken(token) to store the Global Identity JWT for secure local backup (optional)
 */
public class NMDWebBridge {

    public static final String BRIDGE_NAME = "NMDNative";
    /** Same prefs name used by MainActivity (bridge.setToken) and MyFirebaseMessagingService (saveFcmToken). */
    private static final String PREFS_NAME = "nmd_bridge";
    private static final String KEY_CUSTOMER_TOKEN = "customer_token";
    /** FCM token key. MainActivity.requestFcmToken writes here via setToken(); getFCMToken() reads from here. */
    public static final String KEY_FCM_TOKEN = "fcm_token";

    private final Context context;
    private final WebView webView;
    private final OnBottomBarVisibilityListener listener;

    /** FCM token; set from MainActivity or service. */
    private String fcmToken;

    public NMDWebBridge(@NonNull Context context, @NonNull WebView webView, @NonNull OnBottomBarVisibilityListener listener) {
        this.context = context.getApplicationContext();
        this.webView = webView;
        this.listener = listener;
    }

    /**
     * Called from native when FCM token is available. Safe to call from any thread.
     * Persists to SharedPreferences so getToken/getFCMToken and the service stay in sync.
     */
    public void setToken(@Nullable String token) {
        String value = token != null ? token : "";
        this.fcmToken = value;
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().putString(KEY_FCM_TOKEN, value).apply();
    }

    /**
     * Called from MyFirebaseMessagingService.onNewToken when FCM refreshes the token.
     * Persists so the next getFCMToken() from the web returns the new token.
     */
    public static void saveFcmToken(@NonNull Context context, @Nullable String token) {
        if (context == null || token == null || token.isEmpty()) return;
        context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putString(KEY_FCM_TOKEN, token).apply();
    }

    /** Prefer SharedPreferences so token refreshed in MyFirebaseMessagingService.onNewToken is visible. */
    private String getTokenInternal() {
        String fromPrefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(KEY_FCM_TOKEN, "");
        if (fromPrefs != null && !fromPrefs.isEmpty()) {
            fcmToken = fromPrefs;
            return fromPrefs;
        }
        return fcmToken != null ? fcmToken : "";
    }

    private static final String TAG = "NMD_Bridge";

    /**
     * Called from web JS: NMDNative.getToken() returns the current FCM device token.
     * Returns empty string if token has not been retrieved yet.
     */
    @JavascriptInterface
    public String getToken() {
        String token = getTokenInternal();
        if (token != null && !token.isEmpty()) {
            Log.d(TAG, "getToken() called from JS, token (first 24 chars): " + token.substring(0, Math.min(24, token.length())) + "...");
        } else {
            Log.d(TAG, "getToken() called from JS, token not yet available");
        }
        return token != null ? token : "";
    }

    /**
     * Called from web JS: NMDNative.getFCMToken() returns the FCM token for the Android app (same as getToken).
     * Used after OTP login to send the token to the backend for push notifications.
     * If empty, does one more synchronous read from SharedPreferences (PREFS_NAME/KEY_FCM_TOKEN) in case of timing.
     */
    @JavascriptInterface
    public String getFCMToken() {
        String token = getTokenInternal();
        if (token == null || token.isEmpty()) {
            Log.w(TAG, "getFCMToken() first read empty; re-reading from SharedPreferences (PREFS_NAME=" + PREFS_NAME + ", KEY=" + KEY_FCM_TOKEN + ")");
            token = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(KEY_FCM_TOKEN, "");
            if (token != null && !token.isEmpty()) {
                fcmToken = token;
                Log.d(TAG, "getFCMToken() second read got token (first 24 chars): " + token.substring(0, Math.min(24, token.length())) + "...");
            } else {
                Log.e(TAG, "getFCMToken() token still empty; FCM may not have completed or google-services.json missing");
            }
        } else {
            Log.d(TAG, "getFCMToken() called from JS, token (first 24 chars): " + token.substring(0, Math.min(24, token.length())) + "...");
        }
        return token != null ? token : "";
    }

    /**
     * Called from web JS: NMDNative.setBottomBarVisible(false) when cart/checkout bar is shown,
     * NMDNative.setBottomBarVisible(true) when it is hidden.
     */
    @JavascriptInterface
    public void setBottomBarVisible(final boolean visible) {
        webView.post(() -> listener.onBottomBarVisibilityChange(visible));
    }

    /**
     * Called from web JS: NMDNative.setCustomerToken(token) to store the nmd-customer-token (JWT)
     * for secure local backup. Pass null or empty string to clear. Stored in app-private SharedPreferences.
     */
    @JavascriptInterface
    public void setCustomerToken(final String token) {
        android.content.SharedPreferences.Editor editor =
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();
        if (token != null && !token.isEmpty()) {
            editor.putString(KEY_CUSTOMER_TOKEN, token);
        } else {
            editor.remove(KEY_CUSTOMER_TOKEN);
        }
        editor.apply();
    }

    public interface OnBottomBarVisibilityListener {
        void onBottomBarVisibilityChange(boolean visible);
    }
}
