package com.nmd.customer.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.util.Log;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.navigation.NavigationBarView;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

import android.app.NotificationChannel;
import android.app.NotificationManager;

public class MainActivity extends AppCompatActivity {

    public static final String FCM_DATA_URL = "url";
    public static final String FCM_DATA_ORDER_ID = "order_id";

    private static final long DOUBLE_BACK_INTERVAL_MS = 2000;
    private static final int REQUEST_POST_NOTIFICATIONS = 1001;
    /** Channel ID must match what the server sends (e.g. firebase-admin.ts android.notification.channelId). */
    public static final String FCM_CHANNEL_ID = "new_order_alerts";

    /** Load storefront from bundled assets (assets/public) instead of remote URL. */
    private static final String LOCAL_ASSET_BASE = "file:///android_asset/public";

    private WebView webView;
    private ProgressBar webProgress;
    private BottomNavigationView bottomNav;
    private String baseUrl;
    private NMDWebBridge bridge;

    private boolean pageLoaded;
    private String pendingNotificationUrl;

    private long lastBackTime;
    private int bottomBarHeightPx = -1;
    private boolean logoutJustHappened;
    /** When set, the current load was triggered by a bottom bar tap; syncBottomNavToUrl will skip setSelectedItemId if selection already matches. */
    private int lastBottomNavSelectedId = -1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Create notification channel early so the OS can route FCM messages (required for API 26+).
        createNotificationChannel();
        // Initialize Firebase as early as possible so FCM token retrieval works reliably.
        FirebaseApp.initializeApp(this);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.web_view);
        webProgress = findViewById(R.id.web_progress);
        bottomNav = findViewById(R.id.bottom_nav);
        baseUrl = LOCAL_ASSET_BASE;
        webView.setVisibility(View.INVISIBLE);

        bottomNav.setSaveEnabled(true);
        bottomNav.setZ(100f);

        webView.setBackgroundColor(Color.WHITE);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setWillNotCacheDrawing(false);

        setupWebView();
        setupBridge(); // Must be before first load so NMDNative is ready when page loads (FCM token after login)
        // ONLY load from local assets — never from nmd.marketing or any remote URL
        final String localIndex = "file:///android_asset/public/index.html";
        Log.d("MainActivity", "Loading WebView from local assets: " + localIndex);
        webView.loadUrl(localIndex);
        setupBottomNav();
        setupBackPress();
        // API 33+: request notification permission so we can show FCM messages.
        requestNotificationPermissionIfNeeded();
        // Delay FCM token request slightly so Firebase has time to fully initialize (after SHA-1 update / network warm-up).
        new Handler(Looper.getMainLooper()).postDelayed(this::requestFcmToken, 5000);
        handleNotificationIntent(getIntent());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                FCM_CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(getString(R.string.notification_channel_description));
        channel.enableVibration(true);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return; // 33
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_POST_NOTIFICATIONS);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null || intent.getExtras() == null) return;
        Bundle extras = intent.getExtras();
        // Never load remote URLs (nmd.marketing). Only use order_id to build local fragment.
        String orderId = extras.getString(FCM_DATA_ORDER_ID);
        if (!TextUtils.isEmpty(orderId)) {
            pendingNotificationUrl = getLocalFragmentUrl("/order/" + orderId + "/success");
            tryLoadPendingNotificationUrl();
        }
        // FCM_DATA_URL is ignored so we never redirect to external URL
    }

    private void tryLoadPendingNotificationUrl() {
        if (pendingNotificationUrl == null) return;
        if (!pageLoaded) return;
        runOnUiThread(() -> {
            webView.loadUrl(pendingNotificationUrl);
            pendingNotificationUrl = null;
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                super.onProgressChanged(view, newProgress);
                if (webProgress != null) {
                    webProgress.setProgress(newProgress);
                    webProgress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
                }
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                String msg = "WebView console [" + consoleMessage.messageLevel() + "] " + consoleMessage.message()
                        + " -- " + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber();
                if (consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    Log.e("MainActivity", msg);
                } else {
                    Log.d("MainActivity", msg);
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url == null) return false;
                // Never load storefront from remote; force local assets only
                if (url.contains("nmd.marketing") && !url.contains("file://")) {
                    view.loadUrl(getHomeUrl());
                    return true;
                }
                if (url.contains("/logout")) {
                    clearWebViewCacheAndCookies();
                    logoutJustHappened = true;
                    return false;
                }
                if (url.startsWith(LOCAL_ASSET_BASE + "/")) {
                    String path = url.substring(LOCAL_ASSET_BASE.length());
                    if (path.startsWith("/assets/")) return false;
                    if (path.equals("/") || path.equals("/index.html") || !path.contains(".")) {
                        String fragment = (path.equals("/") || path.equals("/index.html")) ? "" : path;
                        view.loadUrl(getHomeUrl() + (fragment.isEmpty() ? "#/" : "#" + fragment));
                        return true;
                    }
                }
                if (url.contains("login") || url.contains("account")) {
                    String base = getBaseNoSlash();
                    String cookies = CookieManager.getInstance().getCookie(base);
                    boolean hasCookies = cookies != null && !cookies.trim().isEmpty();
                    Log.d("MainActivity", "shouldOverrideUrlLoading: url=" + url + " hasCookies=" + hasCookies);
                    if (hasCookies) {
                        view.loadUrl(getLocalFragmentUrl("/my-account"));
                        return true;
                    }
                }
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                pageLoaded = false;
                // Show progress only when not navigating from bottom bar (avoids any layout/visual change over bar)
                if (webProgress != null && lastBottomNavSelectedId == -1) {
                    webProgress.setVisibility(View.VISIBLE);
                }
                // Do not hide or touch BottomBar here — avoids flicker during navigation
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d("MainActivity", "onPageFinished: url=" + url);
                pageLoaded = true;
                view.setVisibility(View.VISIBLE);
                CookieManager.getInstance().flush();
                injectWebSplashHide(view);
                injectHideWebBottomBar(view);
                injectSessionSyncToStorePath(view);
                injectCartLocalStorageSync(view);
                injectLoginRedirectWatcher(view);
                injectHeaderCartAndBottomBarSync(view);
                syncBottomNavToUrl(url);
                if (logoutJustHappened) {
                    view.evaluateJavascript("window.localStorage.clear();", null);
                    logoutJustHappened = false;
                }
                pushTokenToWebIfReady();
                tryLoadPendingNotificationUrl();
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                Log.e("MainActivity", "onReceivedError: code=" + errorCode + " desc=" + description + " url=" + failingUrl);
            }
        });
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setOffscreenPreRaster(true);

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setVerticalScrollBarEnabled(false);

        // Mandatory: NMDCustomerApp so the web storefront recognizes the app and triggers FCM token send (getFCMToken + POST save-fcm-token).
        String defaultUa = WebSettings.getDefaultUserAgent(this);
        settings.setUserAgentString(defaultUa + " NMDCustomerApp/1.0 NMD-Android-App");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
    }

    private String getHomeUrl() {
        return LOCAL_ASSET_BASE + "/index.html";
    }

    /** URL for in-app route when loading from local assets (hash-based SPA routing). */
    private String getLocalFragmentUrl(String path) {
        String p = (path == null || path.isEmpty()) ? "" : (path.startsWith("/") ? path : "/" + path);
        return getHomeUrl() + "#" + p;
    }

    private void injectWebSplashHide(WebView view) {
        view.evaluateJavascript(
                "(function(){ var s=document.createElement('style'); s.innerHTML='.web-splash-screen, #splash-screen, #splash { display: none !important; }'; (document.head||document.documentElement).appendChild(s); })();",
                null);
    }

    private void injectHideWebBottomBar(WebView view) {
        String css = "div[class*=\"bottom-nav\"], footer nav, .mobile-bottom-bar, nav[class*=\"fixed\"][class*=\"bottom\"] { display: none !important; }";
        String escaped = css.replace("\\", "\\\\").replace("'", "\\'");
        view.evaluateJavascript(
                "(function(){ var s=document.createElement('style'); s.textContent='" + escaped + "'; (document.head||document.documentElement).appendChild(s); })();",
                null);
    }

    private void injectSessionSyncToStorePath(WebView view) {
        String js = "(function(){"
                + "var host = window.location.hostname || '';"
                + "if (!host) return;"
                + "var path = '/';"
                + "try {"
                + "  var c = document.cookie || '';"
                + "  if (c) {"
                + "    c.split(';').forEach(function(pair){"
                + "      var i = pair.indexOf('=');"
                + "      if (i > 0) {"
                + "        var name = pair.substring(0, i).trim();"
                + "        var val = pair.substring(i + 1).trim();"
                + "        if (name) document.cookie = name + '=' + encodeURIComponent(val) + ';path=' + path + ';domain=' + host + ';SameSite=Lax';"
                + "      }"
                + "    });"
                + "  }"
                + "  if (typeof localStorage !== 'undefined') {"
                + "    var keys = ['nmd-customer-token','token','auth','session','access_token','jwt'];"
                + "    keys.forEach(function(k){ var v = localStorage.getItem(k); if (v) localStorage.setItem(k, v); });"
                + "  }"
                + "} catch(e) {}"
                + "})();";
        view.evaluateJavascript(js, null);
    }

    /** Ensures cart in localStorage is shared across all sub-paths (e.g. one store's cart visible everywhere on nmd.marketing). */
    private void injectCartLocalStorageSync(WebView view) {
        String js = "(function(){"
                + "try{"
                + "if(typeof localStorage==='undefined')return;"
                + "var canonicalKey='nmd-cart';"
                + "var best=localStorage.getItem(canonicalKey);"
                + "var bestLen=best?((typeof best==='string'&&best.length)||0):0;"
                + "for(var i=0;i<localStorage.length;i++){"
                + "var k=localStorage.key(i);"
                + "if(!k||k.indexOf('cart')===-1)continue;"
                + "var v=localStorage.getItem(k);"
                + "if(!v)continue;"
                + "var len=v.length;"
                + "if(len>bestLen){best=v;bestLen=len;}"
                + "}"
                + "if(best){localStorage.setItem(canonicalKey,best);}"
                + "}catch(e){}"
                + "})();";
        view.evaluateJavascript(js, null);
    }

    /** Handles GlobalHeader User icon and any login/account links: when user has session, redirect to /my-account. */
    private void injectLoginRedirectWatcher(WebView view) {
        String profileUrl = escapeJsString(getLocalFragmentUrl("/my-account"));
        String js = "(function(){"
                + "document.addEventListener('click', function(e) {"
                + "  var target = e.target.closest('a');"
                + "  if (target && (target.href && (target.href.indexOf('login') !== -1 || target.href.indexOf('account') !== -1))) {"
                + "    if (document.cookie.indexOf('session') !== -1 || document.cookie.indexOf('token') !== -1) {"
                + "      e.preventDefault();"
                + "      e.stopPropagation();"
                + "      window.location.href = '" + profileUrl + "';"
                + "    }"
                + "  }"
                + "}, true);"
                + "})();";
        view.evaluateJavascript(js, null);
    }

    /** Keeps native bottom bar always visible (including on cart/checkout) for consistent Android nav. */
    private void injectHeaderCartAndBottomBarSync(WebView view) {
        String js = "(function(){"
                + "try { if (typeof NMDNative !== 'undefined' && NMDNative.setBottomBarVisible) NMDNative.setBottomBarVisible(true); } catch(e) {}"
                + "})();";
        view.evaluateJavascript(js, null);
    }

    private void clearWebViewCacheAndCookies() {
        if (webView == null) return;
        webView.clearCache(true);
        webView.clearSslPreferences();
        CookieManager.getInstance().removeAllCookies(null);
        CookieManager.getInstance().flush();
    }

    private void syncBottomNavToUrl(String url) {
        if (url == null || bottomNav == null) return;
        int selectedId = R.id.nav_home;
        if (url.contains("/my-activity") || url.contains("/orders")) {
            selectedId = R.id.nav_orders;
        } else if (url.contains("/my-account") || url.contains("/profile")) {
            selectedId = R.id.nav_profile;
        } else if (url.contains("/categories")) {
            selectedId = R.id.nav_categories;
        }
        // Avoid resetting the bar when this load was triggered by a bottom bar tap and selection already matches
        if (lastBottomNavSelectedId != -1) {
            if (selectedId == lastBottomNavSelectedId) {
                lastBottomNavSelectedId = -1;
                return;
            }
            lastBottomNavSelectedId = -1;
        }
        if (bottomNav.getSelectedItemId() != selectedId) {
            bottomNav.setSelectedItemId(selectedId);
        }
    }

    private void setupBridge() {
        NMDWebBridge.OnBottomBarVisibilityListener visibilityListener = this::setBottomBarVisibleAnimated;
        bridge = new NMDWebBridge(this, webView, visibilityListener);
        webView.addJavascriptInterface(bridge, NMDWebBridge.BRIDGE_NAME);
        webView.addJavascriptInterface(new WebAppInterface(this), "Android");
    }

    private void setBottomBarVisibleAnimated(boolean visible) {
        if (bottomNav == null) return;
        runOnUiThread(() -> {
            if (visible) {
                // Already visible and in place — do not re-run animation (prevents flicker on every page load)
                if (bottomNav.getVisibility() == View.VISIBLE && bottomNav.getTranslationY() == 0f) {
                    return;
                }
                if (bottomBarHeightPx <= 0) bottomBarHeightPx = (int) (56 * getResources().getDisplayMetrics().density);
                bottomNav.setVisibility(View.VISIBLE);
                bottomNav.setTranslationY(bottomBarHeightPx);
                bottomNav.animate()
                        .translationY(0f)
                        .setDuration(250)
                        .withEndAction(() -> bottomBarHeightPx = bottomNav.getHeight() > 0 ? bottomNav.getHeight() : bottomBarHeightPx)
                        .start();
            } else {
                if (bottomNav.getVisibility() != View.VISIBLE) return;
                bottomBarHeightPx = bottomNav.getHeight() > 0 ? bottomNav.getHeight() : bottomBarHeightPx;
                if (bottomBarHeightPx <= 0) bottomBarHeightPx = (int) (56 * getResources().getDisplayMetrics().density);
                final int height = bottomBarHeightPx;
                bottomNav.animate()
                        .translationY(height)
                        .setDuration(250)
                        .withEndAction(() -> {
                            bottomNav.setVisibility(View.GONE);
                            bottomNav.setTranslationY(0f);
                        })
                        .start();
            }
        });
    }

    private void setupBottomNav() {
        bottomNav.setLabelVisibilityMode(NavigationBarView.LABEL_VISIBILITY_LABELED);
        bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            String url = null;
            if (id == R.id.nav_home) url = getLocalFragmentUrl("");
            else if (id == R.id.nav_categories) url = getLocalFragmentUrl("/categories");
            else if (id == R.id.nav_orders) url = getLocalFragmentUrl("/my-activity");
            else if (id == R.id.nav_profile) url = getLocalFragmentUrl("/my-account");
            if (url != null) {
                lastBottomNavSelectedId = id;
                webView.loadUrl(url);
            }
            return true;
        });
    }

    private String getBaseNoSlash() {
        return LOCAL_ASSET_BASE;
    }

    private void setupBackPress() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                if (isOnHomePage()) {
                    long now = System.currentTimeMillis();
                    if (now - lastBackTime <= DOUBLE_BACK_INTERVAL_MS) {
                        finish();
                        return;
                    }
                    lastBackTime = now;
                    Toast.makeText(MainActivity.this, R.string.press_again_to_exit, Toast.LENGTH_SHORT).show();
                    return;
                }
                webView.loadUrl(getLocalFragmentUrl(""));
            }
        });
    }

    private boolean isOnHomePage() {
        if (webView == null) return true;
        String url = webView.getUrl();
        if (url == null) return true;
        String home = getHomeUrl();
        return url.equals(home) || url.equals(home + "#") || url.equals(home + "#/") || url.startsWith(home + "#");
    }

    private void requestFcmToken() {
        try {
            FirebaseMessaging.getInstance().getToken()
                    .addOnCompleteListener(task -> {
                        if (task == null || !task.isSuccessful()) {
                            Log.e("NMD_FCM", "Failed to get token", task != null ? task.getException() : new Throwable("task is null"));
                            return;
                        }
                        @Nullable String token = task.getResult();
                        if (token == null || token.isEmpty()) {
                            Log.e("NMD_FCM", "getToken() returned null or empty");
                            return;
                        }
                        if (bridge != null) {
                            bridge.setToken(token);
                            pushTokenToWebIfReady();
                        }
                    });
        } catch (Throwable t) {
            Log.e("NMD_FCM", "requestFcmToken threw", t);
        }
    }

    private void pushTokenToWebIfReady() {
        if (!pageLoaded || bridge == null) return;
        String token = bridge.getToken();
        if (TextUtils.isEmpty(token)) return;
        runOnUiThread(() -> {
            if (webView == null) return;
            String escaped = escapeJsString(token);
            webView.evaluateJavascript(
                    "typeof window.onNativeTokenReceived === 'function' && window.onNativeTokenReceived('" + escaped + "');",
                    null);
        });
    }

    private static String escapeJsString(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("'", "\\'").replace("\r", "\\r").replace("\n", "\\n");
    }
}
