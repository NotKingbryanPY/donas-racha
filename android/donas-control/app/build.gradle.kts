plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
}
android {
    namespace = "com.bryan.donas"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.bryan.donas"
        minSdk = 23
        targetSdk = 35
        versionCode = 14
        versionName = "1.4.2"
        listOf("APP_ID", "API_KEY", "PROJECT_ID", "SENDER_ID", "WEB_CLIENT_ID").forEach { name ->
            val value = providers.gradleProperty("FIREBASE_$name").orNull ?: when (name) { "PROJECT_ID" -> "donascontrol-1f5df"; "SENDER_ID" -> "476925718096"; else -> "" }
            buildConfigField("String", "FIREBASE_$name", "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\"")
        }
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        manifestPlaceholders["appLabel"] = "@string/app_name"
    }
    buildFeatures { viewBinding = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    testOptions { unitTests.isIncludeAndroidResources = true }
    testBuildType = providers.gradleProperty("DEVICE_TEST_BUILD").orElse("debug").get()
    sourceSets.getByName("androidTest").assets.srcDir("schemas")
    val distributionStore = providers.environmentVariable("DONAS_OFFICIAL_STORE_FILE").orNull
    if (distributionStore != null) {
        signingConfigs.create("officialDistribution") {
            storeFile = file(distributionStore)
            storePassword = providers.environmentVariable("DONAS_OFFICIAL_STORE_PASSWORD").get()
            keyAlias = providers.environmentVariable("DONAS_OFFICIAL_KEY_ALIAS").get()
            keyPassword = providers.environmentVariable("DONAS_OFFICIAL_KEY_PASSWORD").get()
        }
    }
    buildTypes {
        create("pilot") {
            initWith(getByName("debug"))
            applicationIdSuffix = ".pilot"
            versionNameSuffix = "-piloto"
            manifestPlaceholders["appLabel"] = "Donas Control Piloto"
            matchingFallbacks += listOf("debug")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        create("official") {
            initWith(getByName("release"))
            // A permanent identity; the pilot stays installed until its backup is transferred.
            applicationIdSuffix = ".control"
            signingConfig = if (distributionStore != null) signingConfigs.getByName("officialDistribution") else null
            isDebuggable = false
            manifestPlaceholders["appLabel"] = "@string/app_name"
            matchingFallbacks += listOf("release")
        }
    }
    lint {
        abortOnError = true
        warningsAsErrors = true
        // Deliberately pin this tested SDK 35 / API 23 compatible dependency set.
        disable += listOf("GradleDependency", "HardcodedText", "SetTextI18n", "OldTargetApi") // SDK 35 is pinned until Android 36 behavior is tested on a device.
    }
}
ksp { arg("room.schemaLocation", "$projectDir/schemas") }
dependencies {
    // Verified on Google Maven/AAR metadata: Auth 24.1+ requires Kotlin 2.3,
    // Auth 25 also requires API 24. Preserve Kotlin 2.1.20 and Android 6/API 23.
    implementation(platform("com.google.firebase:firebase-bom:34.12.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")
    implementation("androidx.credentials:credentials:1.6.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.6.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("androidx.recyclerview:recyclerview:1.4.0")
    implementation("androidx.room:room-runtime:2.7.1")
    implementation("androidx.room:room-ktx:2.7.1")
    ksp("androidx.room:room-compiler:2.7.1")
    implementation("androidx.datastore:datastore-preferences:1.1.4")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.robolectric:robolectric:4.14.1")
    testImplementation("androidx.test:core:1.6.1")
    testImplementation("androidx.work:work-testing:2.9.1")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
