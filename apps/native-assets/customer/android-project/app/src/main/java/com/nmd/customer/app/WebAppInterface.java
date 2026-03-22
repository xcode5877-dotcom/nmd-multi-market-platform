package com.nmd.customer.app;

import android.content.Context;
import android.util.Log;
import android.webkit.JavascriptInterface;

import androidx.annotation.NonNull;

/**
 * JavaScript interface exposed as "Android" so the web can call Android.postMessage(fcmToken)
 * to send the FCM token to native. The token is persisted via NMDWebBridge.saveFcmToken and
 * can then be read by NMDNative.getFCMToken() or used for backend registration.
 */
public class WebAppInterface {

    private static final String TAG = "WebAppInterface";

    private final Context context;

    public WebAppInterface(@NonNull Context context) {
        this.context = context.getApplicationContext();
    }

    /**
     * Called from web JS: Android.postMessage(token) to send the FCM token to native.
     * Saves the token so it is available to NMDNative.getFCMToken() and for backend POST.
     */
    @JavascriptInterface
    public void postMessage(String message) {
        if (message == null) return;
        String token = message.trim();
        if (token.isEmpty()) return;
        Log.d(TAG, "postMessage received FCM token (first 24 chars): " + token.substring(0, Math.min(24, token.length())) + "...");
        NMDWebBridge.saveFcmToken(context, token);
    }
}
