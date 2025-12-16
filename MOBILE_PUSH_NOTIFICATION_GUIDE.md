# 📱 Mobile Push Notification Implementation Guide

Complete guide for implementing Firebase push notifications with images, deep links, and custom data in your mobile app.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Notification Features](#notification-features)
3. [Android Implementation](#android-implementation)
4. [iOS Implementation](#ios-implementation)
5. [Flutter Implementation](#flutter-implementation)
6. [React Native Implementation](#react-native-implementation)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

The backend sends Firebase Cloud Messaging (FCM) notifications with the following structure:

### Notification Payload Example:

```json
{
  "notification": {
    "title": "🎁 New Offers Available!",
    "body": "Hi, we have new offers just for you",
    "imageUrl": "https://example.com/banner.jpg"
  },
  "data": {
    "actionUrl": "https://www.linkedin.com/",
    "type": "promotion",
    "hasImage": "true",
    "screen": "offers",
    "timestamp": "1234567890"
  },
  "android": {
    "priority": "high",
    "channelId": "promotions",
    "ttl": 86400000,
    "notification": {
      "imageUrl": "https://example.com/banner.jpg",
      "clickAction": "https://www.linkedin.com/",
      "sound": "default"
    }
  },
  "apns": {
    "payload": {
      "aps": {
        "sound": "default",
        "category": "https://www.linkedin.com/"
      }
    },
    "fcmOptions": {
      "imageUrl": "https://example.com/banner.jpg"
    }
  }
}
```

---

## ✨ Notification Features

Your app needs to handle:

1. **Rich Notifications** - Display banner images (2:1 ratio recommended)
2. **Deep Linking** - Navigate to specific screens when notification is tapped
3. **Custom Data** - Additional data for app navigation and logic
4. **Priority Handling** - High priority shows immediately
5. **Notification Channels** (Android) - Categorize notifications
6. **Sounds** - Default, custom, or silent notifications

---

## 🤖 Android Implementation

### Prerequisites

**build.gradle (Project level):**
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.3.15'
    }
}
```

**build.gradle (App level):**
```gradle
dependencies {
    implementation 'com.google.firebase:firebase-messaging:23.1.2'
    implementation 'com.google.firebase:firebase-analytics:21.2.2'
}

apply plugin: 'com.google.gms.google-services'
```

**AndroidManifest.xml:**
```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application>
        <!-- Firebase Messaging Service -->
        <service
            android:name=".MyFirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

        <!-- Notification channels (Android 8.0+) -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="promotions" />

        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@drawable/ic_notification" />

        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:resource="@color/colorPrimary" />
    </application>
</manifest>
```

### Create Notification Channels

**MainActivity.java / MainActivity.kt:**
```kotlin
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channels = listOf(
                NotificationChannel(
                    "promotions",
                    "Promotions & Offers",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Special offers and promotions"
                    enableLights(true)
                    enableVibration(true)
                },
                NotificationChannel(
                    "campaigns",
                    "Campaign Updates",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Campaign status updates"
                },
                NotificationChannel(
                    "default",
                    "General Notifications",
                    NotificationManager.IMPORTANCE_DEFAULT
                )
            )

            val manager = getSystemService(NotificationManager::class.java)
            channels.forEach { manager.createNotificationChannel(it) }
        }
    }
}
```

### Handle Notifications with Images

**MyFirebaseMessagingService.kt:**
```kotlin
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.core.app.NotificationCompat
import java.net.URL

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        remoteMessage.notification?.let { notification ->
            val title = notification.title ?: "Notification"
            val body = notification.body ?: ""
            val imageUrl = notification.imageUrl?.toString()
            val actionUrl = remoteMessage.data["actionUrl"]
            val channelId = remoteMessage.data["androidChannelId"] ?: "default"

            showNotification(title, body, imageUrl, actionUrl, channelId, remoteMessage.data)
        }
    }

    private fun showNotification(
        title: String,
        body: String,
        imageUrl: String?,
        actionUrl: String?,
        channelId: String,
        data: Map<String, String>
    ) {
        // Create intent for notification click
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("actionUrl", actionUrl)
            data.forEach { (key, value) -> putExtra(key, value) }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Build notification
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        // Load and set image if provided
        imageUrl?.let {
            try {
                val bitmap = loadImageFromUrl(it)
                bitmap?.let { img ->
                    notificationBuilder
                        .setStyle(
                            NotificationCompat.BigPictureStyle()
                                .bigPicture(img)
                                .bigLargeIcon(null) // Hide large icon when expanded
                        )
                        .setLargeIcon(img)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // Show notification
        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }

    private fun loadImageFromUrl(imageUrl: String): Bitmap? {
        return try {
            val url = URL(imageUrl)
            BitmapFactory.decodeStream(url.openConnection().getInputStream())
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Send token to backend
        sendTokenToBackend(token)
    }

    private fun sendTokenToBackend(token: String) {
        // TODO: Send FCM token to your backend API
        // POST /api/influencer/fcm-token with { "fcmToken": token }
    }
}
```

### Handle Deep Links

**MainActivity.kt:**
```kotlin
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Handle notification click
        handleNotificationIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleNotificationIntent(intent)
    }

    private fun handleNotificationIntent(intent: Intent?) {
        intent?.let {
            val actionUrl = it.getStringExtra("actionUrl")
            val screen = it.getStringExtra("screen")
            val customData = it.extras

            when {
                // Handle web URLs
                actionUrl?.startsWith("http") == true -> {
                    openWebUrl(actionUrl)
                }
                // Handle app deep links (e.g., app://campaigns/123)
                actionUrl?.startsWith("app://") == true -> {
                    handleDeepLink(actionUrl, customData)
                }
                // Handle screen navigation
                screen != null -> {
                    navigateToScreen(screen, customData)
                }
            }
        }
    }

    private fun openWebUrl(url: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        startActivity(intent)
    }

    private fun handleDeepLink(deepLink: String, extras: Bundle?) {
        // Parse deep link (e.g., app://campaigns/123)
        val uri = Uri.parse(deepLink)
        val path = uri.path?.removePrefix("/")

        when (uri.host) {
            "campaigns" -> {
                val campaignId = path
                // Navigate to campaign details screen
                navigateToCampaign(campaignId, extras)
            }
            "offers" -> {
                // Navigate to offers screen
                navigateToOffers(extras)
            }
            "top-influencers" -> {
                // Navigate to top influencers screen
                navigateToTopInfluencers(extras)
            }
        }
    }

    private fun navigateToScreen(screenName: String, extras: Bundle?) {
        when (screenName) {
            "campaign-details" -> {
                val campaignId = extras?.getString("campaignId")
                navigateToCampaign(campaignId, extras)
            }
            "offers" -> navigateToOffers(extras)
            "top-influencers" -> navigateToTopInfluencers(extras)
        }
    }
}
```

---

## 🍎 iOS Implementation

### Prerequisites

**Podfile:**
```ruby
platform :ios, '13.0'

target 'YourApp' do
  use_frameworks!

  # Firebase
  pod 'Firebase/Messaging'
  pod 'Firebase/Analytics'
end
```

Run: `pod install`

**AppDelegate.swift:**
```swift
import UIKit
import Firebase
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {

    func application(_ application: UIApplication,
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

        // Configure Firebase
        FirebaseApp.configure()

        // Set messaging delegate
        Messaging.messaging().delegate = self

        // Request notification permissions
        UNUserNotificationCenter.current().delegate = self
        let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
        UNUserNotificationCenter.current().requestAuthorization(options: authOptions) { granted, _ in
            print("Notification permission granted: \\(granted)")
        }

        application.registerForRemoteNotifications()

        return true
    }

    // MARK: - FCM Token
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("FCM Token: \\(fcmToken ?? "")")

        // Send token to backend
        if let token = fcmToken {
            sendTokenToBackend(token: token)
        }
    }

    // MARK: - Handle Notifications

    // Called when notification arrives while app is in foreground
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                              willPresent notification: UNNotification,
                              withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let userInfo = notification.request.content.userInfo

        // Display notification even when app is in foreground
        completionHandler([[.banner, .badge, .sound]])
    }

    // Called when user taps on notification
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                              didReceive response: UNNotificationResponse,
                              withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo

        // Handle notification click
        handleNotificationClick(userInfo: userInfo)

        completionHandler()
    }

    // MARK: - Deep Link Handling

    private func handleNotificationClick(userInfo: [AnyHashable: Any]) {
        // Get action URL and custom data
        let actionUrl = userInfo["actionUrl"] as? String
        let screen = userInfo["screen"] as? String

        if let urlString = actionUrl {
            if urlString.hasPrefix("http") {
                // Open web URL
                if let url = URL(string: urlString) {
                    UIApplication.shared.open(url)
                }
            } else if urlString.hasPrefix("app://") {
                // Handle app deep link
                handleDeepLink(urlString: urlString, userInfo: userInfo)
            }
        } else if let screenName = screen {
            // Navigate to specific screen
            navigateToScreen(screenName: screenName, userInfo: userInfo)
        }
    }

    private func handleDeepLink(urlString: String, userInfo: [AnyHashable: Any]) {
        guard let url = URL(string: urlString),
              let host = url.host else { return }

        let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        switch host {
        case "campaigns":
            // Navigate to campaign details
            let campaignId = path
            navigateToCampaign(id: campaignId, userInfo: userInfo)

        case "offers":
            // Navigate to offers screen
            navigateToOffers(userInfo: userInfo)

        case "top-influencers":
            // Navigate to top influencers
            navigateToTopInfluencers(userInfo: userInfo)

        default:
            break
        }
    }

    private func navigateToScreen(screenName: String, userInfo: [AnyHashable: Any]) {
        // Get root view controller
        guard let window = UIApplication.shared.windows.first,
              let rootVC = window.rootViewController else { return }

        // Navigate based on screen name
        switch screenName {
        case "campaign-details":
            let campaignId = userInfo["campaignId"] as? String
            navigateToCampaign(id: campaignId, userInfo: userInfo)

        case "offers":
            navigateToOffers(userInfo: userInfo)

        case "top-influencers":
            navigateToTopInfluencers(userInfo: userInfo)

        default:
            break
        }
    }

    private func navigateToCampaign(id: String?, userInfo: [AnyHashable: Any]) {
        // TODO: Implement navigation to campaign details
        // Example: Push CampaignDetailsViewController with campaignId
    }

    private func navigateToOffers(userInfo: [AnyHashable: Any]) {
        // TODO: Implement navigation to offers
    }

    private func navigateToTopInfluencers(userInfo: [AnyHashable: Any]) {
        // TODO: Implement navigation to top influencers
    }

    private func sendTokenToBackend(token: String) {
        // TODO: Send FCM token to backend API
        // POST /api/influencer/fcm-token with { "fcmToken": token }
    }
}
```

### Rich Notifications with Images (iOS)

To display images, you need a **Notification Service Extension**.

**1. Add Notification Service Extension:**
- In Xcode: File → New → Target → Notification Service Extension
- Name it `NotificationService`

**2. NotificationService.swift:**
```swift
import UserNotifications

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest,
                           withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        if let bestAttemptContent = bestAttemptContent {
            // Get image URL from notification
            if let imageUrlString = request.content.userInfo["gcm.notification.imageUrl"] as? String ??
                                   request.content.userInfo["imageUrl"] as? String,
               let imageUrl = URL(string: imageUrlString) {

                // Download image
                downloadImage(from: imageUrl) { attachment in
                    if let attachment = attachment {
                        bestAttemptContent.attachments = [attachment]
                    }
                    contentHandler(bestAttemptContent)
                }
            } else {
                contentHandler(bestAttemptContent)
            }
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // Called just before the extension will be terminated
        if let contentHandler = contentHandler,
           let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    private func downloadImage(from url: URL,
                              completion: @escaping (UNNotificationAttachment?) -> Void) {
        let task = URLSession.shared.downloadTask(with: url) { location, response, error in
            guard let location = location else {
                completion(nil)
                return
            }

            // Create attachment
            let tmpDirectory = NSTemporaryDirectory()
            let tmpFile = "image_\(UUID().uuidString).jpg"
            let tmpPath = tmpDirectory + tmpFile

            do {
                try FileManager.default.moveItem(atPath: location.path, toPath: tmpPath)
                let attachment = try UNNotificationAttachment(
                    identifier: "image",
                    url: URL(fileURLWithPath: tmpPath),
                    options: nil
                )
                completion(attachment)
            } catch {
                print("Error creating attachment: \\(error)")
                completion(nil)
            }
        }
        task.resume()
    }
}
```

**3. Info.plist (Notification Service Extension):**
Add `App Transport Security Settings` to allow HTTP images (if needed):
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

---

## 🎯 Flutter Implementation

### Setup

**pubspec.yaml:**
```yaml
dependencies:
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.9
  flutter_local_notifications: ^16.3.0
  url_launcher: ^6.2.2
```

Run: `flutter pub get`

### Initialize Firebase

**main.dart:**
```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

// Handle background messages
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('Handling background message: ${message.messageId}');
}

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase
  await Firebase.initializeApp();

  // Set background message handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  // Initialize local notifications
  await initializeLocalNotifications();

  // Request permission
  await requestNotificationPermission();

  // Get FCM token
  String? token = await FirebaseMessaging.instance.getToken();
  print('FCM Token: $token');
  // TODO: Send token to backend

  runApp(MyApp());
}

Future<void> initializeLocalNotifications() async {
  const AndroidInitializationSettings initializationSettingsAndroid =
      AndroidInitializationSettings('@mipmap/ic_launcher');

  const DarwinInitializationSettings initializationSettingsIOS =
      DarwinInitializationSettings(
    requestAlertPermission: true,
    requestBadgePermission: true,
    requestSoundPermission: true,
  );

  const InitializationSettings initializationSettings = InitializationSettings(
    android: initializationSettingsAndroid,
    iOS: initializationSettingsIOS,
  );

  await flutterLocalNotificationsPlugin.initialize(
    initializationSettings,
    onDidReceiveNotificationResponse: onNotificationClick,
  );

  // Create Android notification channels
  await createNotificationChannels();
}

Future<void> createNotificationChannels() async {
  const AndroidNotificationChannel promotionsChannel = AndroidNotificationChannel(
    'promotions',
    'Promotions & Offers',
    description: 'Special offers and promotions',
    importance: Importance.high,
  );

  const AndroidNotificationChannel campaignsChannel = AndroidNotificationChannel(
    'campaigns',
    'Campaign Updates',
    description: 'Campaign status updates',
    importance: Importance.defaultImportance,
  );

  await flutterLocalNotificationsPlugin
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(promotionsChannel);

  await flutterLocalNotificationsPlugin
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(campaignsChannel);
}

Future<void> requestNotificationPermission() async {
  FirebaseMessaging messaging = FirebaseMessaging.instance;

  NotificationSettings settings = await messaging.requestPermission(
    alert: true,
    badge: true,
    sound: true,
  );

  print('User granted permission: ${settings.authorizationStatus}');
}

// Handle notification click
void onNotificationClick(NotificationResponse response) {
  final payload = response.payload;
  if (payload != null) {
    // Parse payload and handle navigation
    handleNotificationPayload(payload);
  }
}
```

### Handle Foreground Notifications

**notification_service.dart:**
```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _flutterLocalNotificationsPlugin =
      FlutterLocalNotificationsPlugin();

  void initialize() {
    // Listen to foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('Got a message whilst in the foreground!');
      print('Message data: ${message.data}');

      if (message.notification != null) {
        showNotificationWithImage(message);
      }
    });

    // Handle notification opened app
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('Notification caused app to open from background');
      handleNotificationClick(message.data);
    });

    // Check if app was opened from terminated state
    FirebaseMessaging.instance.getInitialMessage().then((message) {
      if (message != null) {
        print('App opened from terminated state');
        handleNotificationClick(message.data);
      }
    });
  }

  Future<void> showNotificationWithImage(RemoteMessage message) async {
    final notification = message.notification;
    final data = message.data;

    if (notification == null) return;

    final channelId = data['androidChannelId'] ?? 'default';
    final imageUrl = notification.android?.imageUrl ?? data['imageUrl'];

    // Download image if provided
    BigPictureStyleInformation? bigPictureStyle;
    if (imageUrl != null && imageUrl.isNotEmpty) {
      try {
        final response = await http.get(Uri.parse(imageUrl));
        if (response.statusCode == 200) {
          final ByteArrayAndroidBitmap bitmap = ByteArrayAndroidBitmap(response.bodyBytes);
          bigPictureStyle = BigPictureStyleInformation(
            bitmap,
            largeIcon: bitmap,
            contentTitle: notification.title,
            summaryText: notification.body,
            htmlFormatContentTitle: true,
            htmlFormatSummaryText: true,
          );
        }
      } catch (e) {
        print('Error loading image: $e');
      }
    }

    final AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
      channelId,
      channelId == 'promotions' ? 'Promotions & Offers' : 'Notifications',
      channelDescription: 'Notification channel',
      importance: Importance.high,
      priority: Priority.high,
      styleInformation: bigPictureStyle ?? BigTextStyleInformation(notification.body ?? ''),
    );

    final NotificationDetails notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: const DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      ),
    );

    await _flutterLocalNotificationsPlugin.show(
      DateTime.now().millisecond,
      notification.title,
      notification.body,
      notificationDetails,
      payload: jsonEncode(data),
    );
  }

  void handleNotificationClick(Map<String, dynamic> data) {
    final actionUrl = data['actionUrl'];
    final screen = data['screen'];

    if (actionUrl != null && actionUrl.toString().isNotEmpty) {
      if (actionUrl.startsWith('http')) {
        // Open web URL
        launchUrl(actionUrl);
      } else if (actionUrl.startsWith('app://')) {
        // Handle deep link
        handleDeepLink(actionUrl, data);
      }
    } else if (screen != null) {
      // Navigate to screen
      navigateToScreen(screen, data);
    }
  }

  void handleDeepLink(String deepLink, Map<String, dynamic> data) {
    final uri = Uri.parse(deepLink);
    final host = uri.host;
    final path = uri.path.replaceFirst('/', '');

    switch (host) {
      case 'campaigns':
        // Navigate to campaign details
        navigateToCampaign(path, data);
        break;
      case 'offers':
        // Navigate to offers screen
        navigateToOffers(data);
        break;
      case 'top-influencers':
        // Navigate to top influencers
        navigateToTopInfluencers(data);
        break;
    }
  }

  void navigateToScreen(String screenName, Map<String, dynamic> data) {
    // TODO: Implement screen navigation
    // Example: Navigator.pushNamed(context, '/campaign-details', arguments: data);
  }

  void navigateToCampaign(String? campaignId, Map<String, dynamic> data) {
    // TODO: Navigate to campaign screen
  }

  void navigateToOffers(Map<String, dynamic> data) {
    // TODO: Navigate to offers screen
  }

  void navigateToTopInfluencers(Map<String, dynamic> data) {
    // TODO: Navigate to top influencers screen
  }

  Future<void> launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }
}
```

---

## ⚛️ React Native Implementation

### Setup

**Install packages:**
```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
# or
yarn add @react-native-firebase/app @react-native-firebase/messaging
```

**index.js:**
```javascript
import messaging from '@react-native-firebase/messaging';

// Register background handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
});

AppRegistry.registerComponent(appName, () => App);
```

**App.js:**
```javascript
import React, { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import { Linking, Alert } from 'react-native';

function App() {
  useEffect(() => {
    requestUserPermission();
    getFCMToken();

    // Listen to foreground messages
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      Alert.alert(
        remoteMessage.notification.title,
        remoteMessage.notification.body
      );
      // Show custom notification with image
      showNotificationWithImage(remoteMessage);
    });

    // Handle notification opened app
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification caused app to open from background state:', remoteMessage);
      handleNotificationClick(remoteMessage);
    });

    // Check if app was opened from a notification (killed state)
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('Notification caused app to open from quit state:', remoteMessage);
          handleNotificationClick(remoteMessage);
        }
      });

    return unsubscribe;
  }, []);

  const requestUserPermission = async () => {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Authorization status:', authStatus);
    }
  };

  const getFCMToken = async () => {
    const fcmToken = await messaging().getToken();
    if (fcmToken) {
      console.log('FCM Token:', fcmToken);
      // Send to backend
      sendTokenToBackend(fcmToken);
    }
  };

  const sendTokenToBackend = async (token) => {
    // TODO: Send to your backend API
    // fetch('https://api.example.com/fcm-token', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ fcmToken: token })
    // });
  };

  const handleNotificationClick = (remoteMessage) => {
    const { data } = remoteMessage;
    const actionUrl = data?.actionUrl;
    const screen = data?.screen;

    if (actionUrl) {
      if (actionUrl.startsWith('http')) {
        // Open URL
        Linking.openURL(actionUrl);
      } else if (actionUrl.startsWith('app://')) {
        // Handle deep link
        handleDeepLink(actionUrl, data);
      }
    } else if (screen) {
      // Navigate to screen
      navigateToScreen(screen, data);
    }
  };

  const handleDeepLink = (deepLink, data) => {
    const url = new URL(deepLink);
    const host = url.hostname;
    const path = url.pathname.replace('/', '');

    switch (host) {
      case 'campaigns':
        navigateToCampaign(path, data);
        break;
      case 'offers':
        navigateToOffers(data);
        break;
      case 'top-influencers':
        navigateToTopInfluencers(data);
        break;
    }
  };

  const navigateToScreen = (screenName, data) => {
    // TODO: Use your navigation library (React Navigation, etc.)
    // navigation.navigate(screenName, { params: data });
  };

  const navigateToCampaign = (campaignId, data) => {
    // navigation.navigate('CampaignDetails', { campaignId, ...data });
  };

  const navigateToOffers = (data) => {
    // navigation.navigate('Offers', data);
  };

  const navigateToTopInfluencers = (data) => {
    // navigation.navigate('TopInfluencers', data);
  };

  return (
    <View>
      {/* Your app content */}
    </View>
  );
}

export default App;
```

---

## 🧪 Testing

### 1. Send Test Notification from Backend

Use the test HTML file or API:

```bash
curl -X POST http://localhost:3002/api/admin/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "title": "Test Notification",
    "body": "Testing image and deep link",
    "imageUrl": "https://example.com/image.jpg",
    "actionUrl": "app://campaigns/123",
    "priority": "high",
    "receiverType": "influencers",
    "specificReceivers": [YOUR_USER_ID]
  }'
```

### 2. Test Scenarios

✅ **Test these scenarios:**

1. **App in Foreground** - Notification should display immediately
2. **App in Background** - Tapping notification should open app and navigate
3. **App Killed** - Tapping notification should launch app and navigate
4. **Image Display** - Banner image should show in notification
5. **Deep Link** - Tapping should navigate to correct screen
6. **Web URL** - Tapping should open browser/in-app browser
7. **Custom Data** - App should receive and use custom data

### 3. Debug Logs

**Android Logcat:**
```bash
adb logcat | grep FCM
```

**iOS Console:**
```bash
# In Xcode: View → Debug Area → Activate Console
# Filter: "FCM" or "Notification"
```

---

## 🔧 Troubleshooting

### Notification Not Received

**Check:**
1. ✅ FCM token was sent to backend
2. ✅ Notification permission granted
3. ✅ Correct `google-services.json` (Android) or `GoogleService-Info.plist` (iOS)
4. ✅ Firebase project matches app bundle ID
5. ✅ Device has internet connection

**Android:**
```bash
adb logcat | grep FirebaseMessaging
```

**iOS:**
Check Xcode console for Firebase errors

### Image Not Displaying

**Check:**
1. ✅ Image URL is HTTPS (not HTTP)
2. ✅ Image is accessible (not behind auth)
3. ✅ Image size is reasonable (<1MB recommended)
4. ✅ Notification Service Extension configured (iOS)
5. ✅ BigPictureStyle implemented (Android)

### Deep Link Not Working

**Check:**
1. ✅ Intent handling configured in MainActivity (Android)
2. ✅ URL scheme registered in Info.plist (iOS)
3. ✅ `actionUrl` is in notification data
4. ✅ Navigation logic implemented
5. ✅ App handles both foreground and background clicks

### Token Not Updating

**Solution:**
```dart
// Flutter: Listen for token refresh
FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
  sendTokenToBackend(newToken);
});
```

```kotlin
// Android: Override onNewToken
override fun onNewToken(token: String) {
    sendTokenToBackend(token)
}
```

```swift
// iOS: Implement messaging delegate
func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    sendTokenToBackend(token: fcmToken)
}
```

---

## 📚 Additional Resources

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Android Notification Guide](https://developer.android.com/develop/ui/views/notifications)
- [iOS Notification Guide](https://developer.apple.com/documentation/usernotifications)
- [Flutter Firebase Messaging](https://firebase.flutter.dev/docs/messaging/overview/)
- [React Native Firebase](https://rnfirebase.io/messaging/usage)

---

## 📞 Backend API Reference

### Update FCM Token

**Endpoint:** `POST /api/influencer/fcm-token` or `POST /api/brand/fcm-token`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "fcmToken": "your-fcm-token-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "FCM token updated successfully"
}
```

---

## ✅ Implementation Checklist

### Android
- [ ] Add Firebase dependencies
- [ ] Configure `google-services.json`
- [ ] Create notification channels
- [ ] Implement `FirebaseMessagingService`
- [ ] Handle image loading
- [ ] Implement deep link handling
- [ ] Send FCM token to backend
- [ ] Test all notification scenarios

### iOS
- [ ] Add Firebase pods
- [ ] Configure `GoogleService-Info.plist`
- [ ] Request notification permissions
- [ ] Implement notification delegates
- [ ] Create Notification Service Extension for images
- [ ] Implement deep link handling
- [ ] Send FCM token to backend
- [ ] Test all notification scenarios

### Flutter
- [ ] Add Firebase packages
- [ ] Initialize Firebase
- [ ] Create notification channels
- [ ] Handle foreground notifications
- [ ] Implement background handler
- [ ] Handle notification clicks
- [ ] Implement deep linking
- [ ] Test all scenarios

### React Native
- [ ] Install Firebase packages
- [ ] Configure native files
- [ ] Request permissions
- [ ] Handle foreground/background notifications
- [ ] Implement deep linking
- [ ] Send token to backend
- [ ] Test all scenarios

---

**Need help?** Contact the backend team or refer to the Firebase documentation.

**Last Updated:** December 2025
