package com.nmd.customer.app;

import android.util.Log;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Handles FCM push notifications. Add google-services.json to app/ for Firebase to work.
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "NMD_FCM";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "FCM token refreshed");
        NMDWebBridge.saveFcmToken(getApplicationContext(), token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        Log.d(TAG, "From: " + message.getFrom());
        if (message.getNotification() != null) {
            Log.d(TAG, "Notification: " + message.getNotification().getTitle() + " - " + message.getNotification().getBody());
            // Optionally show a system notification or in-app UI
        }
    }
}
