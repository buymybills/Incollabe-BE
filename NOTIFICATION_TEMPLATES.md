# Push Notification Templates for Approval

## Overview
This document contains all notification templates used in the Collabkaroo platform. These templates define the title, message body, and data payload for each notification type.

---

## 1. CAMPAIGN-RELATED NOTIFICATIONS

### 1.1 Campaign Application Status Updates

#### **Application Approved**
- **Title:** `Campaign Update: {campaignName}`
- **Message:** `Congratulations! {brandName} approved your application.`
- **Icon:** ✅
- **Action:** View Campaign Details
- **Data:**
  ```json
  {
    "type": "campaign_status",
    "campaignName": "Summer Fashion Campaign",
    "status": "approved",
    "brandName": "Nike",
    "action": "view_campaign"
  }
  ```

#### **Application Rejected**
- **Title:** `Campaign Update: {campaignName}`
- **Message:** `Your application for "{campaignName}" was not selected this time. Don't give up!`
- **Icon:** ❌
- **Action:** View Other Campaigns
- **Data:**
  ```json
  {
    "type": "campaign_status",
    "campaignName": "Summer Fashion Campaign",
    "status": "rejected",
    "brandName": "Nike",
    "action": "view_campaign"
  }
  ```

#### **Application Under Review**
- **Title:** `Campaign Update: {campaignName}`
- **Message:** `Your application is under review by {brandName}.`
- **Icon:** ⏳
- **Action:** View Application Status
- **Data:**
  ```json
  {
    "type": "campaign_status",
    "campaignName": "Summer Fashion Campaign",
    "status": "pending",
    "brandName": "Nike",
    "action": "view_campaign"
  }
  ```

#### **Campaign Completed**
- **Title:** `Campaign Update: {campaignName}`
- **Message:** `Campaign "{campaignName}" has been completed successfully!`
- **Icon:** 🎉
- **Action:** View Campaign Results
- **Data:**
  ```json
  {
    "type": "campaign_status",
    "campaignName": "Summer Fashion Campaign",
    "status": "completed",
    "brandName": "Nike",
    "action": "view_campaign"
  }
  ```


### 1.2 Brand Notifications

#### **New Campaign Application Received**
- **Title:** `New Campaign Application! 📝`
- **Message:** `{influencerName} applied for your campaign "{campaignName}". Review their profile.`
- **Action:** Review Application
- **Data:**
  ```json
  {
    "type": "new_application",
    "influencerName": "Sarah Johnson",
    "campaignName": "Summer Fashion Campaign",
    "influencerId": "user123",
    "action": "view_application"
  }
  ```

#### **Content Submitted for Review**
- **Title:** `Content Submitted for Review! 📸`
- **Message:** `{influencerName} submitted {contentType} for "{campaignName}". Review now.`
- **Action:** Review Content
- **Data:**
  ```json
  {
    "type": "content_submitted",
    "influencerName": "Sarah Johnson",
    "campaignName": "Summer Fashion Campaign",
    "contentType": "Instagram Post",
    "action": "review_content"
  }
  ```

---

## 2. SOCIAL INTERACTION NOTIFICATIONS

### 2.1 Follower Notifications

#### **New Follower**
- **Title:** `New Follower! 🎉`
- **Message:** `{followerName} started following you! Check out their profile.`
- **Action:** View Follower Profile
- **Data:**
  ```json
  {
    "type": "new_follower",
    "followerName": "John Doe",
    "followerUsername": "johndoe123",
    "followerAvatar": "https://example.com/avatar.jpg",
    "action": "view_profile"
  }
  ```

#### **Follow Back Suggestion**
- **Title:** `Follow Back?`
- **Message:** `{followerName} is following you. Follow them back?`
- **Action:** View Profile & Follow
- **Data:**
  ```json
  {
    "type": "follow_suggestion",
    "followerName": "John Doe",
    "followerUsername": "johndoe123",
    "action": "follow_back"
  }
  ```

### 2.2 Post Interaction Notifications

#### **Post Liked**
- **Title:** `Someone liked your post! ❤️`
- **Message:** `{likerName} liked your post: "{postTitle}"`
- **Action:** View Post
- **Data:**
  ```json
  {
    "type": "post_like",
    "likerName": "Jane Smith",
    "likerUsername": "janesmith",
    "likerAvatar": "https://example.com/avatar.jpg",
    "postTitle": "My latest fashion shoot",
    "postId": "post123",
    "action": "view_post"
  }
  ```

---

## 3. WELCOME & ONBOARDING NOTIFICATIONS

### 3.1 Welcome Message
- **Title:** `Welcome to Collabkaroo! 🎉`
- **Message:** `Hi {userName}, welcome to our influencer platform!`
- **Action:** Complete Profile
- **Data:**
  ```json
  {
    "type": "welcome",
    "userName": "Sarah",
    "action": "complete_profile"
  }
  ```

---

## 4. CAMPAIGN INVITATION NOTIFICATIONS

### 4.1 Campaign Invitation
- **Title:** `New Campaign Invitation! 💼`
- **Message:** `{brandName} has invited you to participate in "{campaignName}"`
- **Action:** View Campaign Details
- **Data:**
  ```json
  {
    "type": "campaign_invite",
    "campaignName": "Summer Fashion Campaign",
    "brandName": "Nike",
    "action": "view_campaign"
  }
  ```

---

## APPROVAL CHECKLIST

- [ ] All message templates are clear and actionable
- [ ] Emoji usage is appropriate and consistent
- [ ] Data payloads include necessary information for deep linking
- [ ] Messages are concise (under 150 characters for body)
- [ ] Tone is consistent with brand voice
- [ ] All notification types are covered
- [ ] Action buttons/deep links are properly defined
- [ ] Timing guidelines are realistic
- [ ] User privacy is respected

---

**Last Updated:** {Current Date}
**Review Required By:** Marketing Team, Product Team, Legal Team
**Implementation Priority:** High