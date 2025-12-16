# Firebase Push Notification Design Guide for Flutter App

## For Design Team & Admin

This guide explains how to send push notifications from Firebase Console and how they appear on Android & iOS devices.

---

## 📱 How Notifications Look on Devices

### **Android (Collapsed State)**
```
┌─────────────────────────────────────────────┐
│ [App Icon]  Campaign Title                  │
│             Your notification message goes  │
│             here. Keep it under 2 lines.    │
│             [Notification Image/Banner]     │
│                                    [2m ago] │
└─────────────────────────────────────────────┘
```

### **Android (Expanded State - Big Picture)**
```
┌─────────────────────────────────────────────┐
│ [App Icon]  Campaign Title                  │
│ Your notification message text              │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │                                         │ │
│ │     [Large Notification Image]          │ │
│ │         (Banner/Big Picture)            │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│                               [Just now]    │
└─────────────────────────────────────────────┘
```

### **iOS (Banner)**
```
┌─────────────────────────────────────────────┐
│ [App Icon] CollabKaroo               [now]  │
│ Campaign Title                              │
│ Your notification message text here         │
│ ┌─────────────────────────────────────────┐ │
│ │   [Notification Image - Small]          │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### **iOS (Rich Notification - Long Press)**
```
┌─────────────────────────────────────────────┐
│          CollabKaroo             [now]      │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │                                         │ │
│ │     [Large Notification Image]          │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Campaign Title                              │
│ Your notification message text here. iOS    │
│ shows more text in rich notifications.      │
│                                             │
│ [View]                        [Dismiss]     │
└─────────────────────────────────────────────┘
```

---

## 🎨 Firebase Console - Notification Composer

### **Step 1: Access Cloud Messaging**
1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project: `InCollab` or `Collabkaroo`
3. Click on **Cloud Messaging** (left sidebar)
4. Click **"Send your first message"** or **"New campaign"**

---

### **Step 2: Compose Notification**

#### **Tab 1: Notification**

| Field | Description | Character Limit | Example | How it Appears |
|-------|-------------|----------------|---------|----------------|
| **Notification title** | Main heading | ~50 chars | `🎯 New Campaign from L'Oreal!` | **Bold text** at top |
| **Notification text** | Message body | ~150 chars (Android), ~200 (iOS) | `Check out the latest beauty campaign. Apply now and earn up to Rs 50,000!` | Regular text below title |
| **Notification image** | Banner/Big Picture URL | Must be HTTPS | `https://cdn.incollab.com/campaigns/loreal-banner.jpg` | Large image in expanded view |
| **Notification name** | Internal name (not shown to users) | - | `Campaign Invite - Jan 2025` | Only visible in Firebase Console |

**Best Practices for Design Team:**
- ✅ **Title**: Keep under 40 characters for best visibility
- ✅ **Text**: Keep under 120 characters (shows fully on most devices)
- ✅ **Image**: Use 2:1 aspect ratio (e.g., 1200x600px)
- ✅ **Image Size**: Under 1MB for fast loading
- ✅ **Image Format**: JPG, PNG, or WebP
- ❌ **Avoid**: GIFs (not supported), Text-heavy images

---

#### **Tab 2: Target**

| Option | When to Use | Example |
|--------|-------------|---------|
| **User segment** | Send to all users or filtered group | All influencers in Mumbai |
| **Topic** | Pre-defined user groups | `topic_beauty_influencers` |
| **Single device** | Test notification to specific device | Use FCM token for testing |

**For Testing:**
- Ask developer for test FCM token
- Use "Single device" option
- Test on both Android & iOS before sending to all users

---

#### **Tab 3: Additional Options**

##### **A. Sound**
```
Default sound     ✓ Recommended
Custom sound      ⚠️ Requires app configuration
Silent            ❌ Not recommended for important notifications
```

##### **B. Expiration**
```
1 day    (24 hours)  - For time-sensitive campaigns
3 days   (72 hours)  - For general notifications  ✓ Recommended
1 week   (7 days)    - For evergreen content
Custom               - Set your own expiration
```

##### **C. Custom Data** (Key-Value Pairs)
This data is sent to the app but NOT shown in notification. Used for app navigation.

| Key | Value Example | Purpose |
|-----|---------------|---------|
| `url` | `app://campaigns/123` | Deep link to open specific screen |
| `campaignId` | `123` | Campaign identifier |
| `type` | `campaign_invite` | Notification category |
| `action` | `view_campaign` | What action to take when tapped |
| `priority` | `high` | Notification importance |

**Example Custom Data:**
```json
{
  "url": "app://campaigns/123",
  "campaignId": "123",
  "campaignName": "L'Oreal Beauty Campaign",
  "brandName": "L'Oreal",
  "type": "campaign_invite",
  "action": "view_campaign",
  "imageUrl": "https://cdn.incollab.com/campaigns/loreal-banner.jpg"
}
```

---

### **Step 3: Schedule (Optional)**

| Option | When to Use |
|--------|-------------|
| **Now** | Immediate notification (testing, urgent announcements) |
| **Schedule** | Plan ahead (campaign launches, midnight releases) |

**Recommended Timing:**
- **Campaigns**: 10 AM - 6 PM (when users are active)
- **Chat Messages**: Immediate (real-time)
- **Rewards**: 11 AM or 3 PM (attention peaks)
- **Avoid**: Late night (10 PM - 8 AM) unless urgent

---

## 📋 Notification Templates for Design Team

### **Template 1: Campaign Invitation**

**Firebase Console Input:**
```
Title:     🎯 New Campaign from [Brand Name]!
Text:      [Campaign Name] - Budget: Rs [Amount]. Apply now!
Image:     [Campaign banner - 1200x600px]

Custom Data:
  url: app://campaigns/[campaignId]
  campaignId: [ID]
  type: campaign_invite
```

**How it Looks:**
- **Android**: Large campaign banner in expanded view
- **iOS**: Campaign banner shown on long-press
- **Action**: Taps to campaign details page

---

### **Template 2: Chat Message**

**Firebase Console Input:**
```
Title:     [Sender Name]
Text:      [Message preview - first 100 chars]
Image:     [Sender's profile picture - 400x400px]

Custom Data:
  url: app://chat/[conversationId]
  conversationId: [ID]
  senderId: [ID]
  type: chat_message
```

**How it Looks:**
- **Android**: Sender's avatar as small icon, message text
- **iOS**: Sender's avatar on the left, message preview
- **Action**: Opens chat conversation

---

### **Template 3: Referral Reward**

**Firebase Console Input:**
```
Title:     💰 You Earned Rs [Amount]!
Text:      Your referral reward is ready to redeem. Tap to claim now!
Image:     [Reward celebration image - 1200x600px]

Custom Data:
  url: app://rewards/redeem
  amount: [Amount]
  type: referral_reward
```

**How it Looks:**
- **Android**: Celebratory image with reward amount
- **iOS**: Reward banner with confetti/celebration theme
- **Action**: Opens redemption page

---

### **Template 4: Application Status**

**Firebase Console Input:**
```
Title:     ✅ Application Approved!
Text:      Congratulations! [Brand Name] selected you for "[Campaign Name]"
Image:     [Brand logo or campaign image - 800x400px]

Custom Data:
  url: app://campaigns/[campaignId]
  status: approved
  type: application_status
```

**How it Looks:**
- **Android**: Success-themed notification with brand image
- **iOS**: Congratulatory banner with brand logo
- **Action**: Opens campaign collaboration details

---

## 🎨 Image Guidelines for Designers

### **Notification Image Specifications**

| Platform | Recommended Size | Aspect Ratio | Max File Size |
|----------|-----------------|--------------|---------------|
| **Android Big Picture** | 1200 x 600 px | 2:1 | 1 MB |
| **iOS Rich Notification** | 1200 x 600 px | 2:1 | 1 MB |
| **Profile Pictures** | 400 x 400 px | 1:1 | 200 KB |
| **Brand Logos** | 512 x 512 px | 1:1 | 300 KB |

### **Design Best Practices**

✅ **DO:**
- Use high-contrast images (visible in both light/dark mode)
- Include brand colors consistently
- Keep important content in center 80% of image
- Use clear, readable fonts if text is in image
- Test images on both white and dark backgrounds
- Compress images (use TinyPNG or similar)

❌ **DON'T:**
- Put critical text near edges (may be cropped)
- Use very light or very dark images (poor contrast)
- Include too much text in image
- Use complex gradients (may look bad on small screens)
- Forget to test on actual devices

---

## 📊 Notification Analytics

After sending, Firebase Console shows:

| Metric | What it Means |
|--------|---------------|
| **Sent** | Total notifications sent |
| **Opened** | Users who tapped notification |
| **Delivered** | Successfully delivered to devices |
| **Impressions** | Notifications shown to users |
| **Conversion Rate** | Opens / Delivered (higher is better) |

**Good Benchmarks:**
- **Open Rate**: 10-20% (depends on content)
- **Delivery Rate**: 85-95% (higher is better)
- **Time to Open**: Under 1 hour for urgent notifications

---

## 🔧 Testing Checklist for Design Team

Before sending to all users:

- [ ] Test notification title length (max 50 chars)
- [ ] Test notification text length (max 120 chars)
- [ ] Test image loads correctly (check URL is public)
- [ ] Test on Android device (physical device or emulator)
- [ ] Test on iOS device (iPhone required for accurate testing)
- [ ] Verify notification opens correct app screen
- [ ] Test in both light and dark mode
- [ ] Check image aspect ratio (should be 2:1)
- [ ] Verify custom data is correct
- [ ] Test timing (send at optimal time)

---

## 🎯 Common Use Cases

### **1. New Campaign Launch**
- **When**: Campaign goes live
- **Title**: "🚀 [Campaign Name] is Now Live!"
- **Image**: Campaign hero banner
- **Timing**: 10 AM on launch day

### **2. Application Status Update**
- **When**: Brand approves/rejects application
- **Title**: "✅ Approved!" or "Application Update"
- **Image**: Brand logo or campaign image
- **Timing**: Immediately after status change

### **3. Chat Message (Offline User)**
- **When**: User receives message while offline
- **Title**: Sender's name
- **Image**: Sender's profile picture
- **Timing**: Immediately

### **4. Referral Credit Earned**
- **When**: Referred user completes action
- **Title**: "💰 You Earned Rs [Amount]!"
- **Image**: Celebration/reward graphic
- **Timing**: Immediately after credit awarded

### **5. Redemption Processed**
- **When**: Admin processes payment
- **Title**: "✅ Payment Sent!"
- **Image**: Payment success graphic
- **Timing**: Within 1 hour of processing

---

## 📱 Platform-Specific Differences

| Feature | Android | iOS |
|---------|---------|-----|
| **Notification Image** | Shows large in expanded view | Shows on long-press |
| **Text Length** | ~150 chars visible | ~200 chars visible |
| **Grouping** | Auto-groups by app | Manual grouping |
| **Action Buttons** | Supported (up to 3) | Supported (configurable) |
| **Sound** | Customizable per channel | App-level only |
| **Badge Count** | Not standard | Automatic badge count |
| **Delivery** | May delay when battery saver on | Immediate (if allowed) |

---

## 🚨 Important Notes

1. **Image URLs must be HTTPS** - HTTP images won't load
2. **Images must be publicly accessible** - No authentication required
3. **FCM tokens expire** - Users may not receive notifications if token is old
4. **Users can disable notifications** - Respect user preferences
5. **Test thoroughly** - Always test on real devices before mass send
6. **Follow guidelines** - Don't spam users with too many notifications

---

## 📞 Support & Questions

**For Testing FCM Tokens:**
- Contact: Dev Team
- They will provide test tokens for both Android & iOS

**For Custom Notification Channels:**
- Contact: Dev Team
- Custom channels need to be configured in app code

**For Notification Images:**
- Upload to: CDN/S3 bucket (ask dev team for URL)
- Format: JPG or PNG
- Max size: 1 MB

---

## ✅ Quick Reference Card

```
╔══════════════════════════════════════════════════════╗
║  FIREBASE NOTIFICATION QUICK GUIDE                   ║
╠══════════════════════════════════════════════════════╣
║  Title:        40-50 chars max                       ║
║  Text:         120 chars max (for best visibility)   ║
║  Image:        1200x600px (2:1 ratio), <1MB          ║
║  Format:       JPG, PNG, WebP                        ║
║  URL:          Must be HTTPS                         ║
║  Custom Data:  Use for app navigation                ║
║  Timing:       10 AM - 6 PM (optimal)                ║
║  Testing:      Always test on real devices!          ║
╚══════════════════════════════════════════════════════╝
```

---

**Last Updated**: 2025-11-29
**App Version**: Flutter 3.x
**Firebase SDK**: v14.7.6
