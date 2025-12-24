import { Injectable } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

@Injectable()
export class NotificationService {
  constructor(private readonly firebaseService: FirebaseService) {}

  async sendWelcomeNotification(fcmToken: string, userName: string) {
    return await this.firebaseService.sendNotification(
      fcmToken,
      'Welcome to Collabkaroo!',
      `Hi ${userName}, welcome to our influencer platform!`,
      {
        type: 'welcome',
        timestamp: Date.now().toString(),
      },
    );
  }

  async sendCampaignInviteNotification(
    fcmTokens: string[],
    campaignName: string,
    brandName: string,
  ) {
    return await this.firebaseService.sendNotification(
      fcmTokens,
      'New Campaign Invitation',
      `${brandName} has invited you to participate in "${campaignName}"`,
      {
        type: 'campaign_invite',
        campaignName,
        brandName,
        timestamp: Date.now().toString(),
      },
    );
  }

  async sendCampaignStatusUpdate(
    fcmTokens: string | string[],
    campaignName: string,
    status: string,
    brandName?: string,
  ) {
    const statusMessages = {
      approved: `Congratulations! ${brandName || 'Brand'} approved your application.`,
      rejected: `Your application for "${campaignName}" was not selected this time. Don't give up!`,
      pending: `Your application is under review by ${brandName || 'the brand'}.`,
      completed: `Campaign "${campaignName}" has been completed successfully!`,
      cancelled: `Campaign "${campaignName}" has been cancelled.`,
      payment_released: `Payment for "${campaignName}" has been released to your account.`,
      content_submitted: `Your content for "${campaignName}" has been submitted for review.`,
      content_approved: `Great! Your content for "${campaignName}" has been approved.`,
      content_revision_requested: `Please revise your content for "${campaignName}". Check the feedback.`,
    };

    return await this.firebaseService.sendNotification(
      fcmTokens,
      `Campaign Update: ${campaignName}`,
      statusMessages[status] || `Campaign status updated to: ${status}`,
      {
        type: 'campaign_status',
        campaignName,
        status,
        brandName: brandName || '',
        timestamp: Date.now().toString(),
        action: 'view_campaign',
      },
    );
  }

  /**
   * Send persistent notification for campaign selection
   * This notification stays until dismissed by the user
   */
  async sendCampaignSelectionNotification(
    fcmTokens: string | string[],
    campaignName: string,
    brandName: string,
    campaignId: number,
    reviewNotes?: string,
  ) {
    const body = reviewNotes
      ? `Congratulations! You've been selected for "${campaignName}" by ${brandName}. ${reviewNotes}`
      : `Congratulations! You've been selected for "${campaignName}" by ${brandName}`;

    return await this.sendCustomNotification(
      fcmTokens,
      'Campaign Selection',
      body,
      {
        type: 'campaign_selected',
        campaignId: campaignId.toString(),
        campaignName,
        brandName,
        persistent: 'true', // Flag for mobile app to show as ongoing notification
        action: 'view_campaign',
      },
      {
        priority: 'high', // High priority for immediate delivery
        androidChannelId: 'campaign_important', // Use high-priority notification channel
        interruptionLevel: 'timeSensitive', // iOS - breaks through Focus modes
        sound: 'default',
      },
    );
  }

  async sendNewFollowerNotification(
    fcmToken: string,
    followerName: string,
    followerUsername?: string,
    followerAvatar?: string,
  ) {
    return await this.firebaseService.sendNotification(
      fcmToken,
      'New Follower! 🎉',
      `${followerName} started following you! Check out their profile.`,
      {
        type: 'new_follower',
        followerName,
        followerUsername: followerUsername || '',
        followerAvatar: followerAvatar || '',
        timestamp: Date.now().toString(),
        action: 'view_profile',
      },
    );
  }

  async sendFollowBackSuggestionNotification(
    fcmToken: string,
    followerName: string,
    followerUsername?: string,
  ) {
    return await this.firebaseService.sendNotification(
      fcmToken,
      'Follow Back?',
      `${followerName} is following you. Follow them back?`,
      {
        type: 'follow_suggestion',
        followerName,
        followerUsername: followerUsername || '',
        timestamp: Date.now().toString(),
        action: 'follow_back',
      },
    );
  }

  async sendPostLikeNotification(
    fcmToken: string,
    likerName: string,
    postTitle: string,
    postId: string,
    likerUsername?: string,
    likerAvatar?: string,
  ) {
    return await this.firebaseService.sendNotification(
      fcmToken,
      'Someone liked your post! ❤️',
      `${likerName} liked your post: "${postTitle}"`,
      {
        type: 'post_like',
        likerName,
        likerUsername: likerUsername || '',
        likerAvatar: likerAvatar || '',
        postTitle,
        postId,
        timestamp: Date.now().toString(),
        action: 'view_post',
      },
    );
  }

  async sendPostCommentNotification(
    fcmToken: string,
    commenterName: string,
    postTitle: string,
    postId: string,
    comment: string,
    commenterUsername?: string,
  ) {
    const truncatedComment =
      comment.length > 50 ? comment.substring(0, 50) + '...' : comment;

    return await this.firebaseService.sendNotification(
      fcmToken,
      'New Comment on Your Post! 💬',
      `${commenterName}: "${truncatedComment}" on "${postTitle}"`,
      {
        type: 'post_comment',
        commenterName,
        commenterUsername: commenterUsername || '',
        postTitle,
        postId,
        comment,
        timestamp: Date.now().toString(),
        action: 'view_post',
      },
    );
  }

  async sendMultipleLikesNotification(
    fcmToken: string,
    postTitle: string,
    postId: string,
    likeCount: number,
  ) {
    return await this.firebaseService.sendNotification(
      fcmToken,
      `Your post is trending! 🔥`,
      `Your post "${postTitle}" has received ${likeCount} likes!`,
      {
        type: 'post_multiple_likes',
        postTitle,
        postId,
        likeCount: likeCount.toString(),
        timestamp: Date.now().toString(),
        action: 'view_post',
      },
    );
  }

  async sendBulkNotificationToTopic(
    topic: string,
    title: string,
    body: string,
    data?: { [key: string]: string },
  ) {
    return await this.firebaseService.sendNotificationToTopic(
      topic,
      title,
      body,
      data,
    );
  }

  // Brand-specific notifications
  async sendNewApplicationNotification(
    fcmTokens: string | string[],
    influencerName: string,
    campaignName: string,
    influencerId: string,
  ) {
    return await this.firebaseService.sendNotification(
      fcmTokens,
      'New Campaign Application! 📝',
      `${influencerName} applied for your campaign "${campaignName}". Review their profile.`,
      {
        type: 'new_application',
        influencerName,
        campaignName,
        influencerId,
        timestamp: Date.now().toString(),
        action: 'view_application',
      },
    );
  }

  async sendContentSubmittedNotification(
    fcmToken: string,
    influencerName: string,
    campaignName: string,
    contentType: string,
  ) {
    return await this.firebaseService.sendNotification(
      fcmToken,
      'Content Submitted for Review! 📸',
      `${influencerName} submitted ${contentType} for "${campaignName}". Review now.`,
      {
        type: 'content_submitted',
        influencerName,
        campaignName,
        contentType,
        timestamp: Date.now().toString(),
        action: 'review_content',
      },
    );
  }

  // Batch notification methods
  async sendBatchCampaignUpdate(
    fcmTokens: string[],
    campaignName: string,
    status: string,
    brandName?: string,
  ) {
    const promises = fcmTokens.map((token) =>
      this.sendCampaignStatusUpdate(token, campaignName, status, brandName),
    );
    return await Promise.allSettled(promises);
  }

  async sendBatchNewFollowerNotifications(
    notifications: Array<{
      fcmToken: string;
      followerName: string;
      followerUsername?: string;
    }>,
  ) {
    const promises = notifications.map(
      ({ fcmToken, followerName, followerUsername }) =>
        this.sendNewFollowerNotification(
          fcmToken,
          followerName,
          followerUsername,
        ),
    );
    return await Promise.allSettled(promises);
  }

  async subscribeUserToTopics(
    fcmToken: string,
    userType: 'influencer' | 'brand',
  ) {
    const topics = ['general_updates'];

    if (userType === 'influencer') {
      topics.push('influencer_updates', 'campaign_opportunities');
    } else if (userType === 'brand') {
      topics.push('brand_updates', 'influencer_applications');
    }

    const subscriptionResults: Array<{
      topic: string;
      success: boolean;
      result?: any;
      error?: string;
    }> = [];

    for (const topic of topics) {
      try {
        const result = await this.firebaseService.subscribeToTopic(
          fcmToken,
          topic,
        );
        subscriptionResults.push({ topic, success: true, result });
      } catch (error) {
        subscriptionResults.push({
          topic,
          success: false,
          error: error.message,
        });
      }
    }

    return subscriptionResults;
  }

  /**
   * Send custom notification with custom title, body and data
   */
  async sendCustomNotification(
    fcmToken: string | string[],
    title: string,
    body: string,
    data: Record<string, any> = {},
    options?: {
      imageUrl?: string;
      actionUrl?: string;
      androidChannelId?: string;
      sound?: string;
      priority?: string;
      expirationHours?: number;
      // iOS-specific options
      badge?: number;
      threadId?: string;
      interruptionLevel?: 'passive' | 'active' | 'timeSensitive' | 'critical';
    },
  ) {
    return await this.firebaseService.sendNotification(
      fcmToken,
      title,
      body,
      {
        ...data,
        timestamp: Date.now().toString(),
      },
      options,
    );
  }
}
