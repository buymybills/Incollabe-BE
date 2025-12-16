# Instagram Graph API - Correct Endpoints Reference

## Important: Two Different Base URLs

Instagram Graph API (for Business/Creator accounts) uses **TWO different base URLs**:

1. **`graph.instagram.com`** - For media-related endpoints
2. **`graph.facebook.com`** - For account-related endpoints

---

## Media Endpoints (graph.instagram.com)

### 1. Get Media Insights (Per Post)
```bash
GET https://graph.instagram.com/{media-id}/insights
    ?metric=engagement,impressions,reach,saved,total_interactions
    &access_token={page-token}
```

**Available Metrics:**

For **IMAGE/CAROUSEL:**
- `engagement` - Total likes + comments
- `impressions` - Total times seen
- `reach` - Unique accounts reached
- `saved` - Number of saves
- `total_interactions` - Likes + comments + saves

For **VIDEO/REELS:**
- All above metrics PLUS:
- `plays` - Video plays
- `video_views` - Video views

**Example Response:**
```json
{
  "data": [
    {
      "name": "engagement",
      "period": "lifetime",
      "values": [{ "value": 342 }],
      "title": "Engagement",
      "description": "Total number of likes and comments",
      "id": "17895695668004550/insights/engagement/lifetime"
    },
    {
      "name": "impressions",
      "period": "lifetime",
      "values": [{ "value": 1247 }],
      "title": "Impressions",
      "description": "Total number of times the media has been seen"
    },
    {
      "name": "reach",
      "period": "lifetime",
      "values": [{ "value": 982 }],
      "title": "Reach",
      "description": "Unique accounts that have seen the media"
    },
    {
      "name": "saved",
      "period": "lifetime",
      "values": [{ "value": 42 }],
      "title": "Saved",
      "description": "Number of saves"
    },
    {
      "name": "total_interactions",
      "period": "lifetime",
      "values": [{ "value": 387 }],
      "title": "Total Interactions"
    }
  ]
}
```

---

### 2. Get Media Details
```bash
GET https://graph.instagram.com/{media-id}
    ?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count
    &access_token={page-token}
```

---

## Account Endpoints (graph.facebook.com)

### 1. Get Instagram Business Account Profile
```bash
GET https://graph.facebook.com/v18.0/{ig-user-id}
    ?fields=id,username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url
    &access_token={page-token}
```

**Example Response:**
```json
{
  "id": "17841405309211844",
  "username": "johndoe_business",
  "name": "John Doe",
  "biography": "Digital Creator 📷",
  "website": "https://johndoe.com",
  "followers_count": 15420,
  "follows_count": 892,
  "media_count": 243,
  "profile_picture_url": "https://scontent.cdninstagram.com/..."
}
```

---

### 2. Get User Media List
```bash
GET https://graph.instagram.com/{ig-user-id}/media
    ?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count
    &limit=25
    &access_token={access-token}
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "17895695668004550",
      "media_type": "IMAGE",
      "media_url": "https://scontent.cdninstagram.com/...",
      "caption": "Beautiful sunset! 🌅",
      "timestamp": "2025-01-15T10:30:00+0000",
      "like_count": 342,
      "comments_count": 28,
      "permalink": "https://www.instagram.com/p/ABC123/"
    }
  ],
  "paging": {
    "cursors": {
      "before": "...",
      "after": "..."
    },
    "next": "..."
  }
}
```

---

### 3. Get Account Insights
```bash
GET https://graph.facebook.com/v18.0/{ig-user-id}/insights
    ?metric=impressions,reach,profile_views,follower_count
    &period=day
    &access_token={page-token}
```

**Available Metrics:**

| Metric | Description | Period Options |
|--------|-------------|----------------|
| `impressions` | Total impressions | day, week, days_28 |
| `reach` | Unique accounts reached | day, week, days_28 |
| `profile_views` | Profile views | day |
| `follower_count` | Daily follower count | day |
| `email_contacts` | Email button clicks | day |
| `phone_call_clicks` | Call button clicks | day |
| `text_message_clicks` | Text button clicks | day |
| `get_directions_clicks` | Directions button clicks | day |
| `website_clicks` | Website link clicks | day |

**Example Response:**
```json
{
  "data": [
    {
      "name": "impressions",
      "period": "day",
      "values": [
        {
          "value": 2458,
          "end_time": "2025-01-15T08:00:00+0000"
        },
        {
          "value": 2891,
          "end_time": "2025-01-16T08:00:00+0000"
        }
      ],
      "title": "Impressions",
      "description": "Total number of times media has been seen"
    },
    {
      "name": "reach",
      "period": "day",
      "values": [
        {
          "value": 1842,
          "end_time": "2025-01-15T08:00:00+0000"
        }
      ],
      "title": "Reach"
    }
  ]
}
```

---

### 4. Get Facebook Pages (to find Instagram Business Account)
```bash
GET https://graph.facebook.com/v18.0/me/accounts
    ?fields=id,name,access_token,instagram_business_account
    &access_token={user-token}
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "134895793791914",
      "name": "My Business Page",
      "access_token": "EAACw...",
      "instagram_business_account": {
        "id": "17841405309211844"
      }
    }
  ]
}
```

---

### 5. Get Comments on Media
```bash
GET https://graph.facebook.com/v18.0/{media-id}/comments
    ?fields=id,text,username,timestamp,like_count
    &access_token={page-token}
```

---

### 6. Get Stories
```bash
GET https://graph.facebook.com/v18.0/{ig-user-id}/stories
    ?fields=id,media_type,media_url,timestamp,permalink
    &access_token={page-token}
```

---

## Quick Reference Table

| Endpoint Type | Base URL | Example |
|--------------|----------|---------|
| **Media Insights** | `graph.instagram.com` | `graph.instagram.com/{media-id}/insights` |
| **Media Details** | `graph.instagram.com` | `graph.instagram.com/{media-id}` |
| **Media List** | `graph.instagram.com` | `graph.instagram.com/{ig-user-id}/media` |
| **Account Profile** | `graph.facebook.com` | `graph.facebook.com/{ig-user-id}` |
| **Account Insights** | `graph.facebook.com` | `graph.facebook.com/{ig-user-id}/insights` |
| **Get Pages** | `graph.facebook.com` | `graph.facebook.com/me/accounts` |
| **Comments** | `graph.facebook.com` | `graph.facebook.com/{media-id}/comments` |
| **Stories** | `graph.facebook.com` | `graph.facebook.com/{ig-user-id}/stories` |

---

## Authentication Flow (Facebook Login for Business)

### Step 1: Generate Login URL
```javascript
const loginUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
  `client_id=${FACEBOOK_APP_ID}` +
  `&display=page` +
  `&extras={"setup":{"channel":"IG_API_ONBOARDING"}}` +
  `&redirect_uri=${REDIRECT_URI}` +
  `&response_type=token` +
  `&scope=instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement`;
```

### Step 2: Handle Callback
User redirected to:
```
{redirect_uri}#access_token={short-lived-token}&long_lived_token={long-lived-token}&expires_in=...
```

### Step 3: Get Instagram Business Account
```bash
GET https://graph.facebook.com/v18.0/me/accounts
    ?fields=id,name,access_token,instagram_business_account
    &access_token={long-lived-token}
```

### Step 4: Store Tokens
- Store `instagram_business_account.id` (e.g., `17841405309211844`)
- Store `page.access_token` (use this for all API calls)
- Token expires in 60 days

---

## Your Current Implementation Status

✅ **Fixed:** Media insights now use `graph.instagram.com`
✅ **Correct:** Account insights use `graph.facebook.com`
✅ **Correct:** Profile data uses `graph.facebook.com`
✅ **Correct:** Media list uses `graph.facebook.com`

---

## Testing Your Endpoints

### Test Media Insights
```bash
curl "https://graph.instagram.com/17895695668004550/insights?metric=engagement,impressions,reach&access_token=YOUR_PAGE_TOKEN"
```

### Test Account Insights
```bash
curl "https://graph.facebook.com/v18.0/17841405309211844/insights?metric=impressions,reach,profile_views&period=day&access_token=YOUR_PAGE_TOKEN"
```

### Test Profile
```bash
curl "https://graph.facebook.com/v18.0/17841405309211844?fields=id,username,followers_count,follows_count,media_count&access_token=YOUR_PAGE_TOKEN"
```

---

## Important Notes

1. ✅ Both APIs require **Instagram Business or Creator** account
2. ✅ Both require **Facebook Page** connection
3. ✅ Use **Page access token** (not user token) for all calls
4. ✅ Token valid for 60 days, refresh before expiry
5. ✅ `graph.instagram.com` for media insights
6. ✅ `graph.facebook.com` for everything else

---

## Summary

Your code has been updated to use the correct endpoints:

- **Media Insights:** `graph.instagram.com/{media-id}/insights` ✅
- **Account Data:** `graph.facebook.com/{ig-user-id}/*` ✅

You're now following the official Meta documentation! 🎉
