package com.nmd.customer.app;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.animation.AnimationUtils;
import android.widget.ImageView;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Entry-point splash screen. Shows NMD branding for max 1500ms,
 * then launches MainActivity. Skips when opened from notification.
 */
public class SplashActivity extends AppCompatActivity {

    private static final long SPLASH_DURATION_MS = 1500;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent main = new Intent(this, MainActivity.class);
        if (getIntent() != null && getIntent().getExtras() != null) {
            main.putExtras(getIntent().getExtras());
            if (isOpenedFromNotification(getIntent())) {
                startActivity(main);
                finish();
                return;
            }
        }

        setContentView(R.layout.activity_splash);
        ImageView logo = findViewById(R.id.splash_logo);
        logo.startAnimation(AnimationUtils.loadAnimation(this, R.anim.splash_logo_fade_in));

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            startActivity(main);
            finish();
        }, SPLASH_DURATION_MS);
    }

    private static boolean isOpenedFromNotification(Intent intent) {
        if (intent == null || intent.getExtras() == null) return false;
        Bundle e = intent.getExtras();
        return e.containsKey(MainActivity.FCM_DATA_URL) || e.containsKey(MainActivity.FCM_DATA_ORDER_ID);
    }
}
