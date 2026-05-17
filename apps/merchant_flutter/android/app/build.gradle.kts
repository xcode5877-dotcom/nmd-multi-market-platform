import java.io.File
import java.util.Properties
import org.gradle.api.GradleException

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val propertiesFile = rootProject.file("key.properties")
if (propertiesFile.exists()) {
    propertiesFile.inputStream().use { keystoreProperties.load(it) }
}

fun signingValue(envName: String, propertyName: String): String? =
    System.getenv(envName)?.takeIf { it.isNotBlank() }
        ?: keystoreProperties.getProperty(propertyName)?.takeIf { it.isNotBlank() }

val releaseStoreFilePath = signingValue("NMD_RELEASE_STORE_FILE", "storeFile")
val releaseStorePassword = signingValue("NMD_RELEASE_STORE_PASSWORD", "storePassword")
val releaseKeyAlias = signingValue("NMD_RELEASE_KEY_ALIAS", "keyAlias")
val releaseKeyPassword = signingValue("NMD_RELEASE_KEY_PASSWORD", "keyPassword")
val releaseStoreType = signingValue("NMD_RELEASE_STORE_TYPE", "storeType")
val hasReleaseSigningConfig = listOf(
    releaseStoreFilePath,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword,
).all { !it.isNullOrBlank() }
val resolvedReleaseStoreFile = releaseStoreFilePath?.let {
    val candidate = File(it)
    if (candidate.isAbsolute) candidate else rootProject.file(it)
}

android {
    namespace = "com.nowmarket.merchant_flutter"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.nowmarket.merchant"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            if (hasReleaseSigningConfig) {
                storeFile = resolvedReleaseStoreFile
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
                if (!releaseStoreType.isNullOrBlank()) {
                    storeType = releaseStoreType
                }
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

flutter {
    source = "../.."
}

gradle.taskGraph.whenReady {
    val releaseBuildRequested = allTasks.any {
        it.path.endsWith(":app:assembleRelease") ||
            it.path.endsWith(":app:bundleRelease") ||
            it.path.endsWith(":app:packageRelease") ||
            it.path.endsWith(":app:signReleaseBundle")
    }
    if (!releaseBuildRequested) return@whenReady

    if (!hasReleaseSigningConfig) {
        throw GradleException(
            "Release signing is required. Provide android/key.properties or " +
                "NMD_RELEASE_STORE_FILE, NMD_RELEASE_STORE_PASSWORD, " +
                "NMD_RELEASE_KEY_ALIAS, and NMD_RELEASE_KEY_PASSWORD.",
        )
    }
    if (resolvedReleaseStoreFile == null || !resolvedReleaseStoreFile.exists()) {
        throw GradleException(
            "Release keystore was not found at '${releaseStoreFilePath}'. " +
                "Use an absolute path or a path relative to android/.",
        )
    }
}
