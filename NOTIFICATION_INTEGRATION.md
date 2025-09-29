# Push Notification Integration Guide

## Overview

This guide shows how to integrate the enhanced notification system into your existing services for campaign updates, follower notifications, and post interactions.

## Integration Examples

### 1. Campaign Service Integration

```typescript
// In your campaign service
import { NotificationService } from '../shared/notification.service';

@Injectable()
export class CampaignService {
  constructor(
    private notificationService: NotificationService,
    // your existing dependencies...
  ) {}

  // When brand approves/rejects influencer application
  async updateApplicationStatus(applicationId: string, status: 'approved' | 'rejected', brandName: string) {
    const application = await this.findApplication(applicationId);
    const campaign = await this.findCampaign(application.campaignId);
    const influencer = await this.findInfluencer(application.influencerId);

    // Update status in database
    await this.updateApplication(applicationId, { status });

    // Send push notification to influencer
    if (influencer.fcmToken) {
      await this.notificationService.sendCampaignStatusUpdate(
        influencer.fcmToken,
        campaign.name,
        status,
        brandName
      );
    }

    return { success: true, message: 'Application status updated and notification sent' };
  }

  // When influencer submits content
  async submitContent(campaignId: string, influencerId: string, contentData: any) {
    const campaign = await this.findCampaign(campaignId);
    const influencer = await this.findInfluencer(influencerId);
    const brand = await this.findBrand(campaign.brandId);

    // Save content to database
    await this.saveContent(campaignId, influencerId, contentData);

    // Notify brand about content submission
    if (brand.fcmToken) {
      await this.notificationService.sendContentSubmittedNotification(
        brand.fcmToken,
        influencer.displayName,
        campaign.name,
        contentData.type // 'image', 'video', 'story', etc.
      );
    }

    return { success: true, message: 'Content submitted and brand notified' };
  }

  // When new campaign application is received
  async applyToCampaign(campaignId: string, influencerId: string) {
    const campaign = await this.findCampaign(campaignId);
    const influencer = await this.findInfluencer(influencerId);
    const brand = await this.findBrand(campaign.brandId);

    // Create application
    const application = await this.createApplication({ campaignId, influencerId });

    // Notify brand about new application
    if (brand.fcmToken) {
      await this.notificationService.sendNewApplicationNotification(
        brand.fcmToken,
        influencer.displayName,
        campaign.name,
        influencerId
      );
    }

    return application;
  }
}
```

### 2. Post Service Integration

```typescript
// In your post service
import { NotificationService } from '../shared/notification.service';

@Injectable()
export class PostService {
  constructor(
    private notificationService: NotificationService,
    // your existing dependencies...
  ) {}

  // When someone likes a post
  async likePost(postId: string, likerId: string) {
    const post = await this.findPost(postId);
    const liker = await this.findUser(likerId);
    const postOwner = await this.findUser(post.userId);

    // Don't notify if user likes their own post
    if (likerId === post.userId) {
      return await this.createLike(postId, likerId);
    }

    // Create like in database
    const like = await this.createLike(postId, likerId);

    // Send notification to post owner
    if (postOwner.fcmToken) {
      await this.notificationService.sendPostLikeNotification(
        postOwner.fcmToken,
        liker.displayName,
        post.title || 'your post',
        postId,
        liker.username,
        liker.avatar
      );
    }

    // Check for milestone likes (10, 50, 100, etc.)
    const totalLikes = await this.countLikes(postId);
    if (this.isLikeMilestone(totalLikes)) {
      await this.notificationService.sendMultipleLikesNotification(
        postOwner.fcmToken,
        post.title || 'your post',
        postId,
        totalLikes
      );
    }

    return like;
  }

  // When someone comments on a post
  async createComment(postId: string, commenterId: string, commentText: string) {
    const post = await this.findPost(postId);
    const commenter = await this.findUser(commenterId);
    const postOwner = await this.findUser(post.userId);

    // Create comment in database
    const comment = await this.saveComment({ postId, commenterId, text: commentText });

    // Don't notify if user comments on their own post
    if (commenterId !== post.userId && postOwner.fcmToken) {
      await this.notificationService.sendPostCommentNotification(
        postOwner.fcmToken,
        commenter.displayName,
        post.title || 'your post',
        postId,
        commentText,
        commenter.username
      );
    }

    return comment;
  }

  private isLikeMilestone(count: number): boolean {
    return count > 0 && (count % 10 === 0 || count % 50 === 0 || count % 100 === 0);
  }
}
```

### 3. User/Follow Service Integration

```typescript
// In your user or follow service
import { NotificationService } from '../shared/notification.service';

@Injectable()
export class FollowService {
  constructor(
    private notificationService: NotificationService,
    // your existing dependencies...
  ) {}

  // When someone follows a user
  async followUser(followerId: string, followedId: string) {
    const follower = await this.findUser(followerId);
    const followed = await this.findUser(followedId);

    // Create follow relationship in database
    const follow = await this.createFollow(followerId, followedId);

    // Send notification to the followed user
    if (followed.fcmToken) {
      await this.notificationService.sendNewFollowerNotification(
        followed.fcmToken,
        follower.displayName,
        follower.username,
        follower.avatar
      );

      // Optional: Send follow back suggestion after a delay
      setTimeout(async () => {
        // Check if they haven't followed back yet
        const hasFollowedBack = await this.checkIfFollowing(followedId, followerId);
        if (!hasFollowedBack && followed.fcmToken) {
          await this.notificationService.sendFollowBackSuggestionNotification(
            followed.fcmToken,
            follower.displayName,
            follower.username
          );
        }
      }, 24 * 60 * 60 * 1000); // 24 hours delay
    }

    return follow;
  }

  // Batch follow notifications (for influencer discovery features)
  async notifyMultipleUsersOfNewFollower(followerData: any, followedUserIds: string[]) {
    const followedUsers = await this.findUsersByIds(followedUserIds);
    const notifications = followedUsers
      .filter(user => user.fcmToken)
      .map(user => ({
        fcmToken: user.fcmToken,
        followerName: followerData.displayName,
        followerUsername: followerData.username
      }));

    return await this.notificationService.sendBatchNewFollowerNotifications(notifications);
  }
}
```

### 4. Brand Dashboard Integration

```typescript
// In your brand service for bulk campaign updates
import { NotificationService } from '../shared/notification.service';

@Injectable()
export class BrandService {
  constructor(
    private notificationService: NotificationService,
    // your existing dependencies...
  ) {}

  // When brand wants to update all campaign participants
  async updateCampaignStatus(campaignId: string, newStatus: string, brandName: string) {
    const campaign = await this.findCampaign(campaignId);
    const applications = await this.findCampaignApplications(campaignId, { status: 'approved' });

    // Update campaign status in database
    await this.updateCampaign(campaignId, { status: newStatus });

    // Get all approved influencers' FCM tokens
    const influencers = await this.findInfluencersByIds(
      applications.map(app => app.influencerId)
    );

    const fcmTokens = influencers
      .filter(inf => inf.fcmToken)
      .map(inf => inf.fcmToken);

    // Send batch notification
    if (fcmTokens.length > 0) {
      await this.notificationService.sendBatchCampaignUpdate(
        fcmTokens,
        campaign.name,
        newStatus,
        brandName
      );
    }

    return {
      success: true,
      notificationsSent: fcmTokens.length,
      message: `Campaign updated and ${fcmTokens.length} influencers notified`
    };
  }
}
```

## Controller Integration Examples

### Add to your existing controllers:

```typescript
// In campaign controller
@Post(':id/apply')
@UseGuards(AuthGuard)
async applyToCampaign(
  @Param('id') campaignId: string,
  @CurrentUser() user: any
) {
  return await this.campaignService.applyToCampaign(campaignId, user.id);
}

@Patch('applications/:id/status')
@UseGuards(AuthGuard)
async updateApplicationStatus(
  @Param('id') applicationId: string,
  @Body() updateDto: { status: 'approved' | 'rejected' },
  @CurrentUser() user: any
) {
  return await this.campaignService.updateApplicationStatus(
    applicationId,
    updateDto.status,
    user.brandName
  );
}

// In post controller
@Post(':id/like')
@UseGuards(AuthGuard)
async likePost(
  @Param('id') postId: string,
  @CurrentUser() user: any
) {
  return await this.postService.likePost(postId, user.id);
}

// In follow controller
@Post('users/:id/follow')
@UseGuards(AuthGuard)
async followUser(
  @Param('id') followedId: string,
  @CurrentUser() user: any
) {
  return await this.followService.followUser(user.id, followedId);
}
```

## Testing Push Notifications

### Test with cURL:

```bash
# Test campaign status notification
curl -X POST http://localhost:3000/firebase/notifications/send \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
-d '{
  "tokens": ["FCM_TOKEN_HERE"],
  "title": "Campaign Update: Summer Fashion",
  "body": "Congratulations! Brand approved your application.",
  "data": {
    "type": "campaign_status",
    "campaignName": "Summer Fashion",
    "status": "approved",
    "action": "view_campaign"
  }
}'

# Test follower notification
curl -X POST http://localhost:3000/firebase/notifications/send \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
-d '{
  "tokens": ["FCM_TOKEN_HERE"],
  "title": "New Follower! 🎉",
  "body": "John Doe started following you! Check out their profile.",
  "data": {
    "type": "new_follower",
    "followerName": "John Doe",
    "action": "view_profile"
  }
}'
```

## Best Practices

1. **Always check for FCM token** before sending notifications
2. **Handle failed notifications** gracefully with try-catch
3. **Batch notifications** when possible for better performance
4. **Include action data** for deep linking in your mobile app
5. **Respect user preferences** - allow users to opt out of certain notification types
6. **Rate limit notifications** to avoid spam
7. **Use topic subscriptions** for broadcast messages

## Notification Types Summary

- `campaign_status` - Application approved/rejected/pending
- `new_follower` - Someone followed you
- `follow_suggestion` - Suggestion to follow back
- `post_like` - Someone liked your post
- `post_comment` - Someone commented on your post
- `post_multiple_likes` - Milestone likes achieved
- `new_application` - New campaign application (for brands)
- `content_submitted` - Content submitted for review (for brands)

Each notification includes relevant metadata for your mobile app to handle deep linking and display appropriate UI.