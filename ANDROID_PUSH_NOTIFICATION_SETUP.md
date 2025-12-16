# 🤖 Android Push Notification Setup Guide

Complete guide for configuring Firebase Cloud Messaging (FCM) to enable Android push notifications.

---

## 📋 Overview

Android push notifications are simpler than iOS - no authentication keys required! You just need to configure Firebase and add the configuration file to your Android app.

### What You Need:
1. ✅ Firebase Console access
2. ✅ `google-services.json` file from Firebase
3. ✅ Android app's package name

---

## 🔥 Step 1: Configure Firebase Project

### 1. Open Firebase Console
- Go to: https://console.firebase.google.com
- Select your project: **Collabkaroo** (or your project name)

### 2. Add Android App (if not already added)
- Click **⚙️ Gear icon** (top-left) → **Project settings**
- Scroll to **Your apps** section
- Click **Add app** → Select **Android** icon

### 3. Register Android App
Fill in the required information:

| Field | Description | Example |
|-------|-------------|---------|
| **Android package name** | Your app's package name (must match exactly) | `com.collabkaroo.app` |
| **App nickname** | Optional friendly name | `Collabkaroo Android` |
| **Debug signing certificate SHA-1** | Optional (for Google Sign-In, Dynamic Links) | `A1:B2:C3:...` |

- Click **Register app**

### 4. Download google-services.json
- Click **Download google-services.json**
- ⚠️ **Save this file** - you'll add it to your Android project

---

## 📱 Step 2: Add Configuration File to Android Project

### 1. Locate google-services.json
You downloaded this file from Firebase Console in Step 1.

### 2. Add to Android Project
Place the file in your Android project:

```
YourAndroidProject/
├── app/
│   ├── google-services.json  ← Put it here!
│   ├── build.gradle
│   └── src/
├── build.gradle
└── settings.gradle
```

**Important:**
- ⚠️ Must be in the `app/` module directory, NOT the root project directory
- ⚠️ File name must be exactly `google-services.json` (lowercase)

### 3. Verify File Contents
Open `google-services.json` and verify it contains your project:

```json
{
  "project_info": {
    "project_number": "123456789012",
    "project_id": "collabkaroo",
    "storage_bucket": "collabkaroo.appspot.com"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:123456789012:android:abc123...",
        "android_client_info": {
          "package_name": "com.collabkaroo.app"
        }
      }
    }
  ]
}
```

**Check:**
- ✅ `project_id` matches your Firebase project
- ✅ `package_name` matches your app's package name exactly

---

## 🛠️ Step 3: Configure Build Files

### 1. Project-level build.gradle
**File:** `YourAndroidProject/build.gradle`

```gradle
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.1.0'
        classpath 'com.google.gms:google-services:4.4.0'  // Add this
        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.0'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
```

### 2. App-level build.gradle
**File:** `YourAndroidProject/app/build.gradle`

```gradle
plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
    id 'com.google.gms.google-services'  // Add this at the top
}

android {
    namespace 'com.collabkaroo.app'
    compileSdk 34

    defaultConfig {
        applicationId "com.collabkaroo.app"  // Must match package name
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }
    // ... rest of config
}

dependencies {
    // Firebase BOM (Bill of Materials) - manages versions
    implementation platform('com.google.firebase:firebase-bom:32.7.0')

    // Firebase Cloud Messaging
    implementation 'com.google.firebase:firebase-messaging-ktx'

    // Firebase Analytics (optional but recommended)
    implementation 'com.google.firebase:firebase-analytics-ktx'

    // Other dependencies
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    // ... your other dependencies
}

// Apply plugin at the bottom
apply plugin: 'com.google.gms.google-services'
```

### 3. Sync Project
- Click **Sync Now** in Android Studio
- Wait for Gradle sync to complete
- ✅ Build should succeed without errors

---

## 🔔 Step 4: Enable Firebase Cloud Messaging API

### 1. Go to Google Cloud Console
- Visit: https://console.cloud.google.com
- Select your Firebase project

### 2. Enable FCM API
- Click **☰ Menu** → **APIs & Services** → **Library**
- Search for: **"Firebase Cloud Messaging API"**
- Click on it → Click **Enable**
- ✅ Should show: "API enabled"

### 3. Verify in Firebase Console
- Firebase Console → Project Settings → Cloud Messaging
- Under **Cloud Messaging API (V1)**, status should be **Enabled**

---

## 🧪 Step 5: Test Android Push Notifications

### 1. Run the App on a Device or Emulator
✅ **Android Emulator works fine** (unlike iOS)
- Real device recommended for accurate testing
- Emulator must have Google Play Services installed

### 2. Grant Notification Permissions
For Android 13+ (API 33+), request runtime permission:

```kotlin
// In MainActivity.onCreate()
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    ActivityCompat.requestPermissions(
        this,
        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
        1001
    )
}
```

### 3. Get FCM Token
Check logs for the FCM token:

```kotlin
// In FirebaseMessagingService
override fun onNewToken(token: String) {
    Log.d("FCM", "New token: $token")
    // Send to backend
    sendTokenToBackend(token)
}

// Or in Application/Activity
FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
    if (task.isSuccessful) {
        val token = task.result
        Log.d("FCM", "FCM Token: $token")
        // Send to backend
    }
}
```

**Example FCM Token:**
```
dXpY3kLm5Qw:APA91bH2Rx8... (152+ characters)
```

### 4. Send Token to Backend
**Endpoint:** `POST /api/influencer/fcm-token`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "fcmToken": "dXpY3kLm5Qw:APA91bH2Rx8..."
}
```

### 5. Create Test Notification from Admin Panel
- Log in to admin panel
- Create new push notification:
  - **Title:** "Test Android Notification"
  - **Body:** "Testing FCM configuration"
  - **Image URL:** `https://picsum.photos/1200/600`
  - **Receiver Type:** Select test user
  - **Send Now**

### 6. Verify Notification Received
✅ **Success:** Notification appears on Android device with image
❌ **Failed:** Check troubleshooting section below

---

## 🐛 Troubleshooting

### Notification Not Received on Android

#### 1. Verify google-services.json
- File location: `app/google-services.json` (not root directory!)
- Package name in JSON matches app's `applicationId`
- File is not corrupted (valid JSON format)

**Check package name:**
```bash
# In app/build.gradle
defaultConfig {
    applicationId "com.collabkaroo.app"  # Must match JSON
}

# In google-services.json
"package_name": "com.collabkaroo.app"  # Must match exactly
```

#### 2. Check Firebase Cloud Messaging API
- Google Cloud Console → APIs & Services → Library
- Search "Firebase Cloud Messaging API"
- Status should be **Enabled**

#### 3. Verify Dependencies
```gradle
# app/build.gradle - Check these lines exist
implementation platform('com.google.firebase:firebase-bom:32.7.0')
implementation 'com.google.firebase:firebase-messaging-ktx'
```

Run:
```bash
./gradlew app:dependencies | grep firebase
```

Should show Firebase dependencies installed.

#### 4. Check Notification Permissions (Android 13+)
```kotlin
// Check if permission granted
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    val permission = ContextCompat.checkSelfPermission(
        this,
        Manifest.permission.POST_NOTIFICATIONS
    )

    if (permission != PackageManager.PERMISSION_GRANTED) {
        // Request permission
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            1001
        )
    }
}
```

User can also manually enable:
- Settings → Apps → Your App → Notifications → Allow notifications

#### 5. Check FCM Token Generation
Add logging:

```kotlin
FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
    if (!task.isSuccessful) {
        Log.e("FCM", "Failed to get token", task.exception)
        return@addOnCompleteListener
    }

    val token = task.result
    Log.d("FCM", "FCM Token: $token")
}
```

If token is null or fails:
- Check internet connection
- Verify Google Play Services installed (on device/emulator)
- Clear app data and retry

#### 6. Check Backend Logs
Look for Android-specific errors:

```bash
# Common Android FCM errors:
❌ "Requested entity was not found"
   → Package name mismatch or app not registered in Firebase

❌ "Invalid registration token"
   → FCM token expired or invalid, request new token

❌ "MismatchSenderId"
   → Wrong Firebase project or google-services.json

❌ "NotRegistered"
   → Token was deleted, app uninstalled, or token expired
```

#### 7. Verify Notification Channels (Android 8.0+)
For Android 8.0+, notifications require a channel:

```kotlin
private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(
            "default",
            "Default Notifications",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "General notifications"
            enableLights(true)
            enableVibration(true)
        }

        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.createNotificationChannel(channel)
    }
}
```

Call this in `Application.onCreate()` or `MainActivity.onCreate()`.

### Images Not Showing

#### 1. Check BigPictureStyle Implementation
```kotlin
// In FirebaseMessagingService
override fun onMessageReceived(message: RemoteMessage) {
    val imageUrl = message.notification?.imageUrl?.toString()
        ?: message.data["imageUrl"]

    if (imageUrl != null) {
        val bitmap = downloadImage(imageUrl)
        if (bitmap != null) {
            val notification = NotificationCompat.Builder(this, "default")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(message.notification?.title)
                .setContentText(message.notification?.body)
                .setLargeIcon(bitmap)
                .setStyle(
                    NotificationCompat.BigPictureStyle()
                        .bigPicture(bitmap)
                        .bigLargeIcon(null as Bitmap?)  // Hide large icon when expanded
                )
                .build()

            notificationManager.notify(0, notification)
        }
    }
}
```

#### 2. Verify Image URL
- Must be HTTPS (not HTTP)
- Must be publicly accessible
- Recommended size: 2:1 ratio (e.g., 1200x600)
- Supported formats: JPEG, PNG, WebP

Test URL:
```bash
curl -I https://example.com/banner.jpg

# Should return:
HTTP/2 200
content-type: image/jpeg
```

#### 3. Check Internet Permission
**AndroidManifest.xml:**
```xml
<uses-permission android:name="android.permission.INTERNET" />
```

### Deep Links Not Working

#### 1. Check Intent Filter in AndroidManifest.xml
```xml
<activity
    android:name=".MainActivity"
    android:exported="true">

    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />

        <!-- Custom URL scheme -->
        <data
            android:scheme="app"
            android:host="campaigns" />
    </intent-filter>

    <!-- HTTP/HTTPS links -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />

        <data
            android:scheme="https"
            android:host="collabkaroo.com" />
    </intent-filter>
</activity>
```

#### 2. Handle Intent in Activity
```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Handle intent
    handleIntent(intent)
}

override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleIntent(intent)
}

private fun handleIntent(intent: Intent?) {
    val data = intent?.data
    if (data != null) {
        Log.d("DeepLink", "Received: $data")
        // Handle deep link
        when (data.host) {
            "campaigns" -> {
                val campaignId = data.path?.trimStart('/')
                // Navigate to campaign
            }
        }
    }
}
```

#### 3. Verify actionUrl in Notification Data
Backend should send:
```json
{
  "data": {
    "actionUrl": "app://campaigns/123"
  }
}
```

---

## 📊 Android vs iOS Setup Comparison

| Aspect | Android | iOS |
|--------|---------|-----|
| **Configuration File** | ✅ `google-services.json` | ✅ `GoogleService-Info.plist` |
| **Authentication Key** | ✅ Not needed! | ❌ APNs key required (.p8) |
| **API to Enable** | ✅ FCM API in Google Cloud | ❌ Not needed |
| **Emulator Support** | ✅ Yes (with Google Play) | ❌ No |
| **Permission** | ✅ Runtime (Android 13+) | ✅ Always runtime |
| **Notification Channels** | ✅ Required (Android 8.0+) | ❌ Not needed |
| **Image Support** | ✅ BigPictureStyle | ✅ Notification Service Extension |
| **Expiration** | ✅ No expiration | ✅ No expiration (with .p8) |

**Winner:** Android is simpler! 🎉

---

## 📚 File Checklist

### Files You Need:

#### From Firebase Console:
- [ ] `google-services.json` - Downloaded from Firebase Project Settings

#### From Google Cloud Console:
- [ ] Firebase Cloud Messaging API - Enabled

#### In Your Android Project:
- [ ] `google-services.json` - Placed in `app/` directory (not root!)
- [ ] `google-services` plugin added to `build.gradle` (project-level)
- [ ] `google-services` plugin applied in `app/build.gradle`
- [ ] Firebase dependencies added to `app/build.gradle`
- [ ] Package name matches Firebase configuration

#### In AndroidManifest.xml:
- [ ] `INTERNET` permission
- [ ] `POST_NOTIFICATIONS` permission (Android 13+)
- [ ] Intent filters for deep links (if using)

#### Firebase Console Configuration:
- [ ] Android app registered
- [ ] Package name correct
- [ ] `google-services.json` downloaded

---

## 🔒 Security Best Practices

### Protect google-services.json

While `google-services.json` is not as sensitive as server keys, still follow best practices:

**Okay to commit to Git:**
✅ `google-services.json` can be committed to version control
- It contains only client-side configuration
- No secret keys or credentials
- Safe to include in app

**Do NOT commit:**
❌ Server-side Firebase Admin SDK credentials
❌ Service account JSON files
❌ API keys with backend permissions

### Use Different Projects for Dev/Prod

Create separate Firebase projects:
- `collabkaroo-dev` - Development environment
- `collabkaroo-staging` - Staging environment
- `collabkaroo-prod` - Production environment

Each has its own `google-services.json`.

**Use build flavors:**
```gradle
android {
    flavorDimensions "environment"

    productFlavors {
        dev {
            dimension "environment"
            applicationIdSuffix ".dev"
            // Use google-services.json from app/src/dev/
        }

        prod {
            dimension "environment"
            // Use google-services.json from app/src/prod/
        }
    }
}
```

---

## 🎯 Quick Verification Checklist

Before sending Android notifications, verify:

### Firebase Console:
- [ ] Android app registered
- [ ] Package name matches app's `applicationId`
- [ ] `google-services.json` downloaded

### Google Cloud Console:
- [ ] Firebase Cloud Messaging API enabled

### Android Project:
- [ ] `google-services.json` in `app/` directory
- [ ] Google Services plugin added to both `build.gradle` files
- [ ] Firebase dependencies added
- [ ] Notification channels created (Android 8.0+)
- [ ] Permissions added to `AndroidManifest.xml`

### App Runtime:
- [ ] App requests notification permission (Android 13+)
- [ ] FCM token generated and logged
- [ ] Token sent to backend API
- [ ] FirebaseMessagingService implemented

### Testing:
- [ ] Test on physical device or emulator
- [ ] Notification permissions granted
- [ ] Test notification received successfully
- [ ] Image displays correctly
- [ ] Deep link navigation works

---

## 📞 Support

### If notifications still don't work:

1. **Check Logcat:**
   ```bash
   adb logcat | grep -i "fcm\|firebase\|notification"
   ```

2. **Test with Firebase Console:**
   - Firebase Console → Cloud Messaging → Send test message
   - Enter your FCM token directly
   - If this works → Issue is with backend
   - If this fails → Issue is with Android app configuration

3. **Verify Google Play Services:**
   ```bash
   adb shell dumpsys package com.google.android.gms | grep version
   ```

4. **Check Backend Logs:**
   ```bash
   tail -f /path/to/logs/application.log | grep -i "firebase\|fcm"
   ```

5. **Contact Firebase Support:**
   - https://firebase.google.com/support

---

## 🔗 Additional Resources

- [Firebase Android Setup](https://firebase.google.com/docs/android/setup)
- [FCM Android Client](https://firebase.google.com/docs/cloud-messaging/android/client)
- [Android Notification Guide](https://developer.android.com/develop/ui/views/notifications)
- [Testing FCM](https://firebase.google.com/docs/cloud-messaging/android/first-message)

---

**Last Updated:** December 2025
**Backend Team Contact:** [Your contact info]
