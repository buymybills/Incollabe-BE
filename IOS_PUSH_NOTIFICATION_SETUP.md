# 🍎 iOS Push Notification Setup Guide

Complete guide for configuring APNs (Apple Push Notification service) authentication to enable iOS push notifications through Firebase.

---

## 📋 Overview

For iOS push notifications to work, Firebase needs to communicate with Apple's APNs servers. This requires uploading an **APNs Authentication Key** to your Firebase project.

### What You Need:
1. ✅ Apple Developer Account (paid membership required)
2. ✅ APNs Authentication Key (.p8 file) from Apple
3. ✅ Firebase Console access
4. ✅ iOS app's Bundle ID

---

## 🔑 Step 1: Generate APNs Authentication Key

### 1. Log in to Apple Developer Portal
- Go to: https://developer.apple.com/account
- Sign in with your Apple Developer account

### 2. Navigate to Keys Section
- Click **Certificates, Identifiers & Profiles**
- Select **Keys** from the left sidebar

### 3. Create a New Key
- Click the **+** button to create a new key
- Enter a **Key Name** (e.g., "Firebase Cloud Messaging Key" or "Push Notifications Key")
- Check the box for **Apple Push Notifications service (APNs)**
- Click **Continue**

### 4. Register and Download
- Click **Register**
- **IMPORTANT**: Click **Download** to save the `.p8` file
  - ⚠️ **You can only download this file ONCE**
  - ⚠️ Save it securely - you cannot re-download it
  - File name format: `AuthKey_XXXXXXXXXX.p8`

### 5. Note Your Key ID and Team ID
- **Key ID**: A 10-character identifier shown on the download page
- **Team ID**: Found in the top-right corner of Apple Developer portal or in Membership section

**Example:**
```
Key ID: ABC123DEFG
Team ID: XYZ987WXYZ
File: AuthKey_ABC123DEFG.p8
```

---

## 🔥 Step 2: Upload APNs Key to Firebase Console

### 1. Open Firebase Console
- Go to: https://console.firebase.google.com
- Select your project: **Collabkaroo** (or your project name)

### 2. Navigate to Project Settings
- Click the **⚙️ Gear icon** (top-left) → **Project settings**
- Select the **Cloud Messaging** tab

### 3. Find iOS App Configuration
- Scroll to the **Apple app configuration** section
- Under **APNs authentication key**, click **Upload**

### 4. Upload the APNs Key
Fill in the following fields:

| Field | Value | Example |
|-------|-------|---------|
| **APNs authentication key** | Upload your `.p8` file | `AuthKey_ABC123DEFG.p8` |
| **Key ID** | 10-character key identifier | `ABC123DEFG` |
| **Team ID** | Your Apple Developer Team ID | `XYZ987WXYZ` |

- Click **Upload**

### 5. Verify Configuration
✅ You should see: **"APNs authentication key uploaded"** with a green checkmark

---

## 📱 Step 3: Configure iOS App in Xcode

### 1. Enable Push Notifications Capability
- Open your iOS project in **Xcode**
- Select your app target
- Go to **Signing & Capabilities** tab
- Click **+ Capability** → Add **Push Notifications**

### 2. Enable Background Modes
- Add **Background Modes** capability
- Check the following boxes:
  - ✅ **Remote notifications**
  - ✅ **Background fetch** (optional, for silent notifications)

### 3. Add Firebase Configuration File
- Download `GoogleService-Info.plist` from Firebase Console:
  - Project Settings → Your iOS App → Download `GoogleService-Info.plist`
- Drag the file into your Xcode project
  - ⚠️ Make sure "Copy items if needed" is checked
  - ⚠️ Make sure it's added to your app target

### 4. Verify Bundle ID Matches
- In Xcode: Target → General → **Bundle Identifier**
- In Firebase: Project Settings → Your iOS App → **Bundle ID**
- ⚠️ **These must match exactly!**

---

## 🧪 Step 4: Test iOS Push Notifications

### 1. Run the App on a Physical Device
⚠️ **iOS Simulator does NOT support push notifications** - you must test on a real iPhone/iPad

### 2. Get the FCM Token
When the app launches, it should request notification permissions and generate an FCM token. Check your logs:

```swift
// In AppDelegate.swift
func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    print("FCM Token: \(fcmToken ?? "")")
    // Send this token to your backend
}
```

**Example FCM Token:**
```
fcR3gT5kLsE:APA91bF7QxYz... (152 characters)
```

### 3. Send the Token to Backend
Use your app's API to save the FCM token:

**Endpoint:** `POST /api/influencer/fcm-token`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "fcmToken": "fcR3gT5kLsE:APA91bF7QxYz..."
}
```

### 4. Create a Test Notification from Admin Panel
- Log in to your admin panel
- Create a new push notification:
  - **Title:** "Test iOS Notification"
  - **Body:** "Testing APNs configuration"
  - **Receiver Type:** Select the test user
  - **Send Now**

### 5. Verify Notification Received
✅ **Success:** Notification appears on iOS device
❌ **Failed:** Check troubleshooting section below

---

## 🐛 Troubleshooting

### Notification Not Received on iOS

#### 1. Check APNs Key Upload
- Firebase Console → Project Settings → Cloud Messaging
- Verify: "APNs authentication key uploaded" shows green checkmark
- If not: Re-upload the `.p8` file with correct Key ID and Team ID

#### 2. Verify Bundle ID
- Xcode Bundle ID must **exactly match** Firebase iOS app Bundle ID
- Check for typos, case sensitivity, and extra spaces

#### 3. Check Push Notifications Capability
- Xcode → Target → Signing & Capabilities
- Verify **Push Notifications** capability is enabled

#### 4. Check Device Permissions
```swift
UNUserNotificationCenter.current().getNotificationSettings { settings in
    print("Notification Status: \(settings.authorizationStatus.rawValue)")
    // 0 = Not Determined, 1 = Denied, 2 = Authorized
}
```

If denied, user must manually enable in iOS Settings:
- Settings → Your App → Notifications → Allow Notifications

#### 5. Check Backend Logs
Look for errors in your NestJS backend logs:

```bash
# Common iOS-specific errors:
❌ "APNs certificate is invalid"
   → Re-upload APNs key in Firebase Console

❌ "Requested entity was not found"
   → Bundle ID mismatch

❌ "MismatchSenderId"
   → Wrong Firebase project or GoogleService-Info.plist

❌ "Invalid registration token"
   → FCM token is invalid or expired, request new token
```

#### 6. Check Firebase Cloud Messaging Logs
- Firebase Console → Cloud Messaging
- Click on a notification to see delivery status
- Check for errors specific to iOS devices

### Images Not Showing in Notifications

#### 1. Verify Notification Service Extension
- Xcode → File → New → Target → **Notification Service Extension**
- Must be named `NotificationService`
- Check `Info.plist` has correct configuration

#### 2. Check Image URL
- Must be HTTPS (not HTTP)
- Must be publicly accessible
- Recommended size: 2:1 ratio (e.g., 1200x600)
- Supported formats: JPEG, PNG, GIF

#### 3. Test Image URL
```bash
# Test if image is accessible
curl -I https://example.com/banner.jpg

# Should return:
HTTP/2 200
content-type: image/jpeg
```

### Deep Links Not Working

#### 1. Check URL Scheme Registration
- Xcode → Target → Info → URL Types
- Add your custom URL scheme (e.g., `myapp://`)

#### 2. Verify Deep Link Handler
```swift
// AppDelegate.swift
func application(_ app: UIApplication,
                open url: URL,
                options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    print("Opened URL: \(url)")
    return true
}
```

#### 3. Check actionUrl in Notification
- Backend should send `actionUrl` in data payload
- Example: `"actionUrl": "app://campaigns/123"`

---

## 📊 APNs vs APNs Certificates (Comparison)

| Feature | APNs Auth Key (.p8) | APNs Certificate (.p12) |
|---------|---------------------|-------------------------|
| **Recommended** | ✅ Yes (Apple & Firebase) | ⚠️ Legacy approach |
| **Expiration** | ✅ Never expires | ❌ Expires yearly |
| **Renewal** | ✅ Not needed | ❌ Must renew annually |
| **Multi-app** | ✅ Works for all apps | ❌ One per app |
| **Revocation** | ✅ Can be revoked anytime | ❌ Harder to manage |
| **Setup** | ✅ Simpler (just upload) | ❌ More complex |

**Recommendation:** Always use **APNs Authentication Key (.p8)** for new projects.

---

## 📚 File Checklist

### Files You Need:

#### From Apple Developer Portal:
- [ ] `AuthKey_XXXXXXXXXX.p8` - APNs Authentication Key (downloaded from Apple)
- [ ] Key ID (10-character string, e.g., `ABC123DEFG`)
- [ ] Team ID (10-character string, e.g., `XYZ987WXYZ`)

#### From Firebase Console:
- [ ] `GoogleService-Info.plist` - Downloaded from Firebase project settings

#### In Your iOS Project:
- [ ] `GoogleService-Info.plist` - Added to Xcode project
- [ ] Push Notifications capability enabled
- [ ] Background Modes capability enabled (Remote notifications)
- [ ] Bundle ID matches Firebase configuration

#### Firebase Console Configuration:
- [ ] APNs Authentication Key uploaded
- [ ] Key ID entered correctly
- [ ] Team ID entered correctly
- [ ] iOS app registered in Firebase project

---

## 🔒 Security Best Practices

### Protect Your APNs Key

⚠️ **NEVER commit `.p8` files to version control**

Add to `.gitignore`:
```gitignore
# APNs Keys
*.p8
AuthKey_*.p8
```

### Store Securely
- ✅ Keep `.p8` file in secure password manager (1Password, LastPass, etc.)
- ✅ Backup to encrypted storage
- ✅ Limit access to only necessary team members
- ❌ Never email or share via unencrypted channels
- ❌ Never commit to Git repositories

### Key Rotation
- Although APNs keys don't expire, rotate them annually for security
- Revoke old keys from Apple Developer portal after uploading new ones
- Update Firebase Console with new key

---

## 🎯 Quick Verification Checklist

Before sending iOS notifications, verify:

### Apple Developer Account:
- [ ] APNs Authentication Key (.p8) generated
- [ ] Key ID and Team ID noted

### Firebase Console:
- [ ] APNs key uploaded to Cloud Messaging settings
- [ ] Key ID and Team ID entered correctly
- [ ] iOS app registered with correct Bundle ID

### iOS App (Xcode):
- [ ] Push Notifications capability enabled
- [ ] Background Modes (Remote notifications) enabled
- [ ] `GoogleService-Info.plist` added to project
- [ ] Bundle ID matches Firebase configuration

### Backend:
- [ ] Firebase Admin SDK configured
- [ ] APNs payload structure implemented
- [ ] FCM token storage working

### Testing:
- [ ] Test on physical iOS device (not simulator)
- [ ] Notification permissions granted
- [ ] FCM token generated and sent to backend
- [ ] Test notification received successfully

---

## 📞 Support

### If notifications still don't work:

1. **Check Firebase Console Logs:**
   - Cloud Messaging → Click on notification → View delivery report

2. **Check Backend Logs:**
   ```bash
   # Look for Firebase errors
   tail -f /path/to/logs/application.log | grep -i "firebase\|apns"
   ```

3. **Test with Firebase Console:**
   - Firebase Console → Cloud Messaging → Send test message
   - Enter your FCM token directly
   - If this works, issue is with backend code
   - If this fails, issue is with APNs configuration

4. **Contact Firebase Support:**
   - https://firebase.google.com/support

---

## 🔗 Additional Resources

- [Apple Developer - Creating APNs Auth Key](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/establishing_a_token-based_connection_to_apns)
- [Firebase - APNs Configuration](https://firebase.google.com/docs/cloud-messaging/ios/client#upload_your_apns_authentication_key)
- [Firebase - iOS Setup](https://firebase.google.com/docs/ios/setup)
- [Troubleshooting iOS Push](https://firebase.google.com/docs/cloud-messaging/ios/first-message)

---

**Last Updated:** December 2025
**Backend Team Contact:** [Your contact info]
