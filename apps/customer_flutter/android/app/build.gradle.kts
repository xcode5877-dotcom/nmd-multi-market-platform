import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Apply when google-services.json is present (run `flutterfire configure` for com.nowmarket.app).
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

val keystoreProperties = Properties()
val propertiesFile = rootProject.file("key.properties")
if (propertiesFile.exists()) {
    propertiesFile.inputStream().use { keystoreProperties.load(it) }
}

android {
    namespace = "com.nowmarket.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.nowmarket.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            // Prefer key.properties for local release signing, with env vars as optional CI override.
            val storeFilePath = System.getenv("NMD_RELEASE_STORE_FILE")
                ?: keystoreProperties.getProperty("storeFile")
            val storePasswordEnv = System.getenv("NMD_RELEASE_STORE_PASSWORD")
                ?: keystoreProperties.getProperty("storePassword")
            val keyAliasEnv = System.getenv("NMD_RELEASE_KEY_ALIAS")
                ?: keystoreProperties.getProperty("keyAlias")
            val keyPasswordEnv = System.getenv("NMD_RELEASE_KEY_PASSWORD")
                ?: keystoreProperties.getProperty("keyPassword")
            if (!storeFilePath.isNullOrBlank()) {
                storeFile = file(storeFilePath)
            }
            if (!storePasswordEnv.isNullOrBlank()) {
                storePassword = storePasswordEnv
            }
            if (!keyAliasEnv.isNullOrBlank()) {
                keyAlias = keyAliasEnv
            }
            if (!keyPasswordEnv.isNullOrBlank()) {
                keyPassword = keyPasswordEnv
            }
        }
    }

    buildTypes {
        release {
            // Uses release signing when key.properties or env vars are provided, else falls back to debug.
            val hasReleaseConfig = !(
                (System.getenv("NMD_RELEASE_STORE_FILE")
                    ?: keystoreProperties.getProperty("storeFile")).isNullOrBlank()
            )
            signingConfig = if (hasReleaseConfig) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
